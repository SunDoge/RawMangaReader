
import { HttpsProxyAgent } from "https-proxy-agent";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import AdmZip from "adm-zip";
import tar from "tar"
import assert from "assert";



const ONNXRUNTIME_VERSION = "1.15.1";
const ONNXRUNTIME_BASE_URL = "https://github.com/microsoft/onnxruntime/releases/download"



/**
 * 
 * @param {string} platform linux, darwin, win32
 * @param {string} arch x64, ia32, arm64, arm
 * @param {string} accelerator 
 * @returns {string} url
 */
function inferDownloadUrl(platform, arch, accelerator) {
    if (platform === 'linux') {
        // 只有x64
        assert.equal(arch, 'x64', "linux only have x64 arch");
        if (accelerator === 'cpu') {
            return `${ONNXRUNTIME_BASE_URL}/v${ONNXRUNTIME_VERSION}/onnxruntime-linux-x64-${ONNXRUNTIME_VERSION}.tgz`
        } else if (accelerator === 'gpu') {
            return `${ONNXRUNTIME_BASE_URL}/v${ONNXRUNTIME_VERSION}/onnxruntime-linux-x64-gpu-${ONNXRUNTIME_VERSION}.tgz`
        } else {
            throw new Error(`Unknown accelerator: ${accelerator}`)
        }
    } else if (platform === 'darwin') {
        assert.equal(accelerator, 'cpu', "macos only have cpu accelerator")
        if (arch === 'x64') {
            return `${ONNXRUNTIME_BASE_URL}/v${ONNXRUNTIME_VERSION}/onnxruntime-osx-x86_64-${ONNXRUNTIME_VERSION}.tgz`
        } else if (arch == 'arm64') {
            return `${ONNXRUNTIME_BASE_URL}/v${ONNXRUNTIME_VERSION}/onnxruntime-osx-arm64-${ONNXRUNTIME_VERSION}.tgz`
        } else {
            throw new Error(`Unknown arch: ${arch}`)
        }
    } else if (platform === 'win32') {
        if (arch === 'ia32') {
            arch = 'x86'
        }
        if (accelerator === 'gpu' && arch === 'x64') {
            return `${ONNXRUNTIME_BASE_URL}/v${ONNXRUNTIME_VERSION}/onnxruntime-win-x64-gpu-${ONNXRUNTIME_VERSION}.zip`
        } else if (accelerator === 'cpu') {
            return `${ONNXRUNTIME_BASE_URL}/v${ONNXRUNTIME_VERSION}/onnxruntime-win-${arch}-${ONNXRUNTIME_VERSION}.zip`
        } else {
            throw new Error(`Unknown accelerator: ${accelerator}`)
        }
    } else {
        throw new Error(`Unknown platform: ${platform}`)
    }
}

async function main() {
    const url = inferDownloadUrl(
        process.platform,
        // "darwin",
        process.arch,
        process.env.ACCELERATOR || 'cpu'
    )
    const extension = process.platform === "win32" ? "zip" : "tgz";
    const filename = `onnxruntime.${extension}`;
    console.log(`[INFO]: download from ${url}`)
    console.log(`[INFO]: save to ${filename}`)
    await downloadFile(url, filename)

    if (extension === "zip") {
        // 解压到根目录
        await extractZip(filename, "src-tauri");
    } else {
        await extractTgz(filename, "src-tauri", process.platform);
    }
}


/**
 * 
 * @param {string} url 
 * @param {string} path 
 */
async function downloadFile(url, path) {
    if (fs.existsSync(path)) {
        console.log(`[INFO]: file "${path}" already exists, skip download`);
        return;
    }

    const options = {};

    const httpProxy =
        process.env.HTTP_PROXY ||
        process.env.http_proxy ||
        process.env.HTTPS_PROXY ||
        process.env.https_proxy;

    if (httpProxy) {
        options.agent = new HttpsProxyAgent(httpProxy);
    }

    const response = await fetch(url, {
        ...options,
        method: "GET",
        headers: { "Content-Type": "application/octet-stream" },
    });
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(path, new Uint8Array(buffer));

    console.log(`[INFO]: download finished "${url}" to "${path}"`);
}

/**
 * For linux and macos
 * 
 * @param {string} filename 
 * @param {string} outputDir 
 * @param {string} platform
 */
async function extractTgz(filename, outputDir, platform) {
    // if (!fs.existsSync(EXTRACT_DIR)) {
    //     fs.mkdirSync(EXTRACT_DIR);
    // }
    // try {
    //     await execCmd(`tar -xvf ${filename} -C ${EXTRACT_DIR}`);
    //     await execCmd(`find -L ${EXTRACT_DIR} -type f -name '*.so' -exec cp -L {} ${outputDir} \\;`)
    // } catch (e) {
    //     throw e;
    // } finally {
    //     fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
    // }

    let dylib_paths = [];
    await tar.t({
        file: filename,
        onentry: entry => {
            if (
                entry.path.includes(".so") ||
                (entry.path.endsWith('.dylib') && !entry.path.includes('DWARF'))
            ) {
                dylib_paths.push(entry.path);
            }
        }
    });

    console.log(`dylib paths: ${dylib_paths}`)
    if (dylib_paths.length === 0) {
        throw new Error('No .so or .dylib file found in the tar file');
    }

    await tar.x(
        {
            file: filename,
            cwd: outputDir,
            // 不知道为什么macos就变成3了
            strip: platform === "linux" ? 2 : 3, // onnxruntime-xxx/lib/libonnxruntime.so
        },
        dylib_paths,
    )
    console.log(`[INFO]: extract finished "${filename}": [${dylib_paths}] to "${outputDir}"`);
}


async function extractZip(filename, outputDir) {
    const zip = new AdmZip(filename);
    zip.forEach((entry) => {
        if (entry.entryName.includes(".dll")) {
            zip.extractEntryTo(entry, outputDir, false, true);
        }
    });
}




main().catch(e => {
    throw e;
})

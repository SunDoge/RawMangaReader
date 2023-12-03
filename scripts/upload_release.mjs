
const GITHUB_TOKEN = "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"
const USERNAME = "SunDoge"
const REPO = "raw-manga-reader"
const AUTH = {"Authorization": `Bearer ${GITHUB_TOKEN}`}
const VERSION = "v0.1.0"

async function main() {
    const res = await fetch(
        `https://api.github.com/repos/${USERNAME}/${REPO}/releases/tags/${VERSION}`,
        {
            headers: {... AUTH}
        }
    )
    const data = await res.json();
    console.log(data)
    // assets: [{url: string, name: string}]
    
    // console.log(assets[0])
    const downloadUrls = data.assets.map((asset) => asset.browser_download_url);
    // console.log(downloadUrls[0])
    for (let url of downloadUrls) {
        console.log(url)
    }
}



main().catch(console.log)

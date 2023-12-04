import { resolveResource } from "@tauri-apps/api/path";

// 自定义排序函数(ChatGPT)
export function naturalSort(a: string, b: string) {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);

    // 如果文件名都能转换为数字，则按数字大小排序
    if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
    }

    // 否则，按字符串的自然顺序排序
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}


export async function getVocabPath() {
    const vocabPath = await resolveResource("resources/vocab.txt");
    console.log(`vocab path: ${vocabPath}`);
    return vocabPath;
}


type ErrorWithMessage = {
    message: string
}

function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as Record<string, unknown>).message === 'string'
    )
}

function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
    if (isErrorWithMessage(maybeError)) return maybeError

    try {
        return new Error(JSON.stringify(maybeError))
    } catch {
        // fallback in case there's an error stringifying the maybeError
        // like with circular references for example.
        return new Error(String(maybeError))
    }
}

export function getErrorMessage(error: unknown) {
    return toErrorWithMessage(error).message
}

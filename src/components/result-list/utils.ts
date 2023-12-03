export const copyToClipBoard = (str: string) => {
    const el = document.createElement('textarea');
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.whiteSpace = 'pre-line';
    el.value = str;
    document.body.append(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
}
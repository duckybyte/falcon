export default function kFormat(num: number) {
    return num > 999999 ? (num / 1e6).toFixed(1) + "m" : num > 999 ? (num / 1000).toFixed(1) + "k" : num + "";
}
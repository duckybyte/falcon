const chars = "qwertyuiopasdfghjklzxcvbnm124567890";

export default function randString(len: number = 7) {
    let result = "";

    for (let i = 0; i < len; i++)
        result += chars[Math.floor(Math.random() * chars.length)];

    return result;
}
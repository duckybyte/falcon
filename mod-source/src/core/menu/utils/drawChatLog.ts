import Menu from "../Menu";

export default function drawChatLog() {
    const chatLogger = document.getElementById(`such_a_sigma_chat_logger`) || document.createElement("div");

    chatLogger.id = "such_a_sigma_chat_logger";
    chatLogger.innerHTML = "";
    chatLogger.classList.add("chatLogger");

    for (const log of Menu.chatLogs) {
        const holder = document.createElement("div");

        const time = document.createElement("span");
        time.style.color = log.type === "leave" ? "#ff0000" : log.type === "death" ? "#ffa600" : log.type === "encounter" ? "#fff531" : "var(--generic-white)";
        time.innerText = `[${log.time}]`;
        holder.appendChild(time);

        const msg = document.createElement("span");
        msg.style.color = log.type === "leave" ? "#ff0000" : log.type === "death" ? "#ffa600" : log.type === "encounter" ? "#fff531" : "var(--generic-white)";
        msg.style.marginLeft = "4px";
        msg.innerText = log.msg;
        holder.appendChild(msg);

        chatLogger.appendChild(holder);
    }

    Menu.contentElement.appendChild(chatLogger);
    window.requestAnimationFrame(() => { chatLogger.scrollTop = chatLogger.scrollHeight; });
}
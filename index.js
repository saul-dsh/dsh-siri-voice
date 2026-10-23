/**
 * dsh-siri-voice — 服务端半（无逻辑）。
 *
 * 这个插件只做 web 客户端的视觉层，但 dsh 的客户端模块扫描是从 Host 的
 * loader entries 出发的，所以包仍然需要一个可被加载的服务端入口：
 * 声明 `dsh.bundle.patch` 把一行插件插进 profile，`dsh.client.platform = 'web'`
 * 让 web 宿主把 client.js 挂到页面里。
 */

export const name = 'siri-voice'

/** 不注册任何服务；所有效果都在客户端。 */
export function apply() {}

export default { name, apply }

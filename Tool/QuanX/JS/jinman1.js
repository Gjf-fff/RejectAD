let body = $response.body;

if (body) {
    const jsToInject = `
    <script>
        // 终极布局核弹：不认字，只认形状
        function nukePopups() {
            try {
                // 1. 斩首行动：杀掉所有 iframe（绝大多数跨域流氓弹窗的藏身之处）
                let iframes = document.querySelectorAll('iframe');
                for (let iframe of iframes) {
                    iframe.remove();
                }

                // 2. 地毯式轰炸：找出所有企图覆盖屏幕的悬浮层
                // 只扫描 body 的直接子元素，提高效率
                let children = document.body.children;
                for (let el of children) {
                    // 排除掉正常的网页主要容器 (通常 header, main, footer 不会是弹窗)
                    if (['HEADER', 'MAIN', 'FOOTER', 'NAV', 'SCRIPT', 'STYLE'].includes(el.tagName)) continue;

                    let style = window.getComputedStyle(el);
                    
                    // 弹窗的特征：必须是 fixed 或 absolute 定位，且层级(z-index)很高
                    if (style.position === 'fixed' || style.position === 'absolute') {
                        let zIndex = parseInt(style.zIndex);
                        
                        // 如果层级大于 50，或者尺寸霸占了屏幕 70% 以上的面积
                        let rect = el.getBoundingClientRect();
                        let isCoveringScreen = (rect.width > window.innerWidth * 0.7) && (rect.height > window.innerHeight * 0.7);

                        if (zIndex > 50 || isCoveringScreen || style.backdropFilter !== 'none') {
                            // 杀！
                            el.style.setProperty('display', 'none', 'important');
                            el.style.setProperty('pointer-events', 'none', 'important');
                            el.remove();
                        }
                    }
                }
            } catch (e) {}
        }

        // 页面刚加载时执行一次
        window.addEventListener('DOMContentLoaded', nukePopups);
        window.addEventListener('load', nukePopups);

        // 开启高频雷达，每 800 毫秒扫描一次，防止它延迟弹出
        setInterval(nukePopups, 800);
    </script>
    `;

    // 注入到网页末尾
    if (body.includes('</body>')) {
        body = body.replace('</body>', jsToInject + '</body>');
    } else if (body.includes('</html>')) {
        body = body.replace('</html>', jsToInject + '</html>');
    } else {
        body += jsToInject;
    }
}
$done({ body });

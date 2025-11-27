/**
 * 网页浏览器功能
 */
document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const urlInput = document.getElementById('urlInput');
    const goButton = document.getElementById('goButton');
    const refreshButton = document.getElementById('refreshButton');
    const backButton = document.getElementById('backButton');
    const forwardButton = document.getElementById('forwardButton');
    const webBrowser = document.getElementById('webBrowser');
    const browserOverlay = document.getElementById('browserOverlay');
    const webTab = document.getElementById('webTab'); // Get the tab content element
    
    // 初始化按钮状态
    if (backButton) backButton.disabled = true;
    if (forwardButton) forwardButton.disabled = true;
    
    // 设置默认URL
    const defaultUrl = 'https://www.liblib.art';
    if (urlInput) {
        urlInput.value = defaultUrl;
    }
    
    // 加载URL函数
    function loadURL(url) {
        if (!url) url = defaultUrl; // Fallback to default if url is empty
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        if (urlInput) urlInput.value = url;
        if (browserOverlay) browserOverlay.classList.remove('hidden');
        
        try {
            if (webBrowser) webBrowser.src = url;
            console.log("Loading URL:", url);
        } catch (error) {
            console.error('加载URL错误:', error);
            showLoadError('无法加载网页，请检查URL是否正确');
        }
    }
    
    // 显示加载错误函数
    function showLoadError(message) {
        const browserMessage = browserOverlay?.querySelector('.browser-message');
        if (browserMessage) {
            browserMessage.textContent = message || '加载失败';
            browserMessage.style.color = 'var(--error-color)';
        }
        if (browserOverlay) browserOverlay.classList.remove('hidden');
    }
    
    // 注册事件监听器
    if (goButton) {
        goButton.addEventListener('click', function() {
            const url = urlInput?.value.trim();
            if (url) loadURL(url);
        });
    }
    if (urlInput) {
        urlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const url = this.value.trim();
                if (url) loadURL(url);
            }
        });
    }
    // 刷新按钮
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            webBrowser.src = webBrowser.src;
        });
    }
    // 后退按钮
    if (backButton) {
        backButton.addEventListener('click', function() {
            if (!this.disabled) {
                webBrowser.contentWindow.history.back();
            }
        });
    }
    // 前进按钮
    if (forwardButton) {
        forwardButton.addEventListener('click', function() {
            if (!this.disabled) {
                webBrowser.contentWindow.history.forward();
            }
        });
    }
    
    // iframe 加载完成/错误事件
    if (webBrowser) {
        webBrowser.addEventListener('load', function() {
            if (browserOverlay) browserOverlay.classList.add('hidden');
            updateNavigationButtons();
            updateURLDisplay();
        });
        webBrowser.addEventListener('error', function(error) {
            console.error('iframe加载错误:', error);
            showLoadError();
        });
    }
    
    // 更新导航按钮和URL显示函数
    function updateNavigationButtons() {
        try {
            // 检查能否后退
            if (webBrowser.contentWindow.history.length > 1) {
                backButton.disabled = false;
            } else {
                backButton.disabled = true;
            }
            
            // 前进按钮状态暂时无法确定，将其禁用
            forwardButton.disabled = true;
        } catch (error) {
            console.error('更新导航按钮状态错误:', error);
            // 出错时禁用按钮
            backButton.disabled = true;
            forwardButton.disabled = true;
        }
    }
    
    function updateURLDisplay() {
        try {
            const currentURL = webBrowser.contentWindow.location.href;
            urlInput.value = currentURL;
        } catch (error) {
            console.error('更新URL显示错误:', error);
        }
    }
    
    // ---- 监听 Web Tab 激活事件 ----
    if (webTab) {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                // 当 'class' 属性变化且包含 'active' 时
                if (mutation.attributeName === 'class' && webTab.classList.contains('active')) {
                     console.log("Web Editor tab activated.");
                     // 只有在 iframe 没有 src 或者 src 不是当前输入框的值时才加载
                     // 防止重复加载或覆盖用户刚输入的 URL
                     const currentInputValue = urlInput?.value || defaultUrl;
                     if (!webBrowser.src || webBrowser.src !== currentInputValue) {
                         console.log("Loading URL on tab activation:", currentInputValue);
                         loadURL(currentInputValue);
                     }
                }
            });
        });
        // 监听 webTab 元素的 class 属性变化
        observer.observe(webTab, { attributes: true });
    }

    // 确保初始状态下 overlay 是隐藏的
    if (browserOverlay) {
         browserOverlay.classList.add('hidden'); 
    }
}); 
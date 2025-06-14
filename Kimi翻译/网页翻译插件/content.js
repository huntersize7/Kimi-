// 记录内容脚本已加载
console.log('网页翻译插件内容脚本已加载');

// 由于内容脚本无法直接访问config.js，需要在运行时从background获取配置
let CONFIG = {
  MAX_TEXT_LENGTH: 20000 // 默认最大长度
};

// 从存储中获取配置信息
chrome.storage.local.get(['maxTextLength'], (result) => {
  if (result.maxTextLength) {
    CONFIG.MAX_TEXT_LENGTH = result.maxTextLength;
    console.log(`从存储获取最大文本长度: ${CONFIG.MAX_TEXT_LENGTH}`);
  } else {
    console.log(`使用默认最大文本长度: ${CONFIG.MAX_TEXT_LENGTH}`);
  }
});

// 监听来自侧边栏的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('内容脚本收到消息:', request);
  
  if (request.action === 'getSelectedText') {
    // 获取当前选中的文本
    const selectedText = window.getSelection().toString().trim();
    console.log('获取到选中文本:', selectedText ? selectedText.substring(0, 50) + '...' : '无选中文本');
    sendResponse({ text: selectedText });
  }
  
  if (request.action === 'getPageContent') {
    // 获取整个网页内容
    const pageContent = getPageContent();
    sendResponse(pageContent);
  }
  
  // 这是一个异步消息处理，返回true表示将使用sendResponse异步响应
  return true;
});

// 右键菜单和图标点击处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('内容脚本收到侧边栏打开消息:', request);
  
  if (request.action === 'openSidePanelWithSelection') {
    // 保存自动处理标记，供侧边栏脚本检查
    if (request.autoProcess) {
      console.log('设置自动处理标记, 模式:', request.mode);
      chrome.storage.local.set({ 
        autoProcess: true,
        lastMode: request.mode
      });
    }
    
    // 确认消息已收到
    sendResponse({ success: true });
  }
  return true;
});

// 在页面加载完成时发送就绪消息
window.addEventListener('load', () => {
  console.log('页面加载完成，内容脚本就绪');
  chrome.runtime.sendMessage({ action: 'contentScriptReady' })
    .then(response => console.log('后台脚本确认内容脚本就绪:', response))
    .catch(error => console.error('发送就绪消息失败:', error));
});

// 获取网页内容
function getPageContent() {
  console.log('开始获取网页内容');
  
  try {
    // 提取页面标题
    const title = document.title;
    
    // 提取页面主要内容
    let content = '';
    
    // 优先提取文章主体内容
    const articleElements = document.querySelectorAll('article, .article, .post, .content, main, #content, #main');
    if (articleElements.length > 0) {
      console.log(`找到${articleElements.length}个主体内容元素`);
      // 使用最大的一个article元素作为主体
      let maxTextLength = 0;
      let bestElement = null;
      
      articleElements.forEach(elem => {
        const text = elem.innerText;
        if (text.length > maxTextLength) {
          maxTextLength = text.length;
          bestElement = elem;
        }
      });
      
      if (bestElement) {
        content = bestElement.innerText;
        console.log(`使用主体内容元素，文本长度: ${content.length}`);
      }
    }
    
    // 如果没有找到足够的内容，尝试提取整个body
    if (content.length < 1000) {
      console.log('主体内容不足，尝试提取整个body');
      content = document.body.innerText;
      console.log(`从body提取的文本长度: ${content.length}`);
    }
    
    // 清理内容，移除多余的空行和空格
    content = content.replace(/\n{3,}/g, '\n\n').trim();
    
    // 如果内容太长，进行截断
    const maxLength = CONFIG?.MAX_TEXT_LENGTH || 20000; // 使用配置中的最大长度，默认20000
    let truncated = false;
    if (content.length > maxLength) {
      console.log(`内容超过长度限制(${maxLength})，将进行截断`);
      content = content.substring(0, maxLength);
      truncated = true;
    }
    
    console.log(`最终内容长度: ${content.length}，是否截断: ${truncated}`);
    
    return {
      title: title,
      text: content,
      url: window.location.href,
      truncated: truncated
    };
  } catch (error) {
    console.error('获取页面内容时发生错误:', error);
    return {
      title: document.title,
      text: '获取内容失败: ' + error.message,
      url: window.location.href,
      truncated: false
    };
  }
} 
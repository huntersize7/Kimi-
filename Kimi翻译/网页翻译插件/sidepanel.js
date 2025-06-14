document.addEventListener('DOMContentLoaded', () => {
  console.log('侧边栏DOM已加载');
  
  // 获取DOM元素
  const translateBtn = document.getElementById('translate-btn');
  const summarizeBtn = document.getElementById('summarize-btn');
  const historyBtn = document.getElementById('history-btn'); // 直接获取历史按钮
  const resultContainer = document.getElementById('result-container');
  const loading = document.getElementById('loading');
  const processBtn = document.getElementById('process-btn');
  const targetLanguage = document.getElementById('target-language');
  const summaryLength = document.getElementById('summary-length');
  const summaryLanguage = document.getElementById('summary-language');
  const translationOptions = document.getElementById('translation-options');
  const summaryOptions = document.getElementById('summary-options');
  const selectTab = document.getElementById('select-tab');
  const inputTab = document.getElementById('input-tab');
  const textInputContainer = document.getElementById('text-input-container');
  const inputText = document.getElementById('input-text');
  const summarizePageBtn = document.getElementById('summarize-page-btn');
  
  // 确认历史按钮是否存在
  if (historyBtn) {
    console.log('侧边栏：历史按钮已找到');
  } else {
    console.error('侧边栏：历史按钮未找到');
  }
  
  let selectedText = '';
  let activeMode = 'translate'; // 'translate' 或 'summarize'
  let inputMode = 'select'; // 'select' 或 'input'
  let historyRecords = []; // 历史记录数组
  
  // 从配置文件获取API密钥
  const API_KEY = CONFIG?.API_KEY || 'sk-wl8wWZvNYsS4keXlAQbewrEskPmrO82ROe8X1XDcLi2pmlN7';
  console.log('API密钥已加载', API_KEY ? '成功' : '失败');
  
  // 初始化: 从存储中加载历史记录
  function loadHistory() {
    chrome.storage.local.get(['historyRecords'], (result) => {
      if (result.historyRecords && Array.isArray(result.historyRecords)) {
        historyRecords = result.historyRecords;
        console.log(`已加载${historyRecords.length}条历史记录`);
      } else {
        console.log('没有找到历史记录或格式不正确');
      }
    });
  }
  
  // 保存历史记录到存储
  function saveHistory(originalText, resultText, mode, language, timestamp, pageInfo = null) {
    // 限制原始文本和结果文本长度，避免存储过大
    const maxStoredTextLength = 1000;
    const trimmedOriginalText = originalText.length > maxStoredTextLength ? 
      originalText.substring(0, maxStoredTextLength) + '...(已截断)' : originalText;
    
    // 创建历史记录对象
    const historyItem = {
      id: Date.now().toString(), // 使用时间戳作为唯一ID
      originalText: trimmedOriginalText,
      resultText: resultText,
      mode: mode, // 'translate' 或 'summarize'
      language: language, // 目标语言
      timestamp: timestamp, // 时间戳
      pageInfo: pageInfo // 如果是网页总结，包含网页信息
    };
    
    // 添加到历史记录数组前端
    historyRecords.unshift(historyItem);
    
    // 限制历史记录数量，最多保存50条
    if (historyRecords.length > 50) {
      historyRecords = historyRecords.slice(0, 50);
    }
    
    // 保存到本地存储
    chrome.storage.local.set({ historyRecords: historyRecords }, () => {
      console.log('历史记录已保存，当前共有', historyRecords.length, '条记录');
    });
  }
  
  // 获取当前选中的文本
  async function getSelectedText() {
    console.log('尝试获取选中文本');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        console.error('无法获取当前标签页');
        return '';
      }
      
      console.log('当前标签页ID:', tab.id);
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
        console.log('获取到选中文本响应:', response);
        return response?.text || '';
      } catch (error) {
        console.error('发送消息到内容脚本失败:', error);
        
        // 尝试注入内容脚本后重试
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          console.log('内容脚本已注入，重试获取文本');
          
          // 短暂延迟后重试
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const retryResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
          return retryResponse?.text || '';
        } catch (retryError) {
          console.error('重试获取文本失败:', retryError);
          return '';
        }
      }
    } catch (error) {
      console.error('获取选中文本出错:', error);
      return '';
    }
  }
  
  // 使用Kimi API进行翻译
  async function translateText(text, targetLang) {
    console.log(`开始翻译文本到${targetLang}`);
    if (!text) {
      console.log('无文本可翻译');
      return '请先选择或输入要翻译的文本';
    }
    
    try {
      console.log(`准备调用Kimi API，文本长度: ${text.length}, 目标语言: ${targetLang}`);
      
      // 构建提示词
      let systemPrompt = '你是一个专业的翻译助手，请将用户提供的文本翻译成目标语言，只返回翻译结果，不要有任何解释或者其他内容。';
      let userPrompt = '';
      
      if (targetLang === 'zh') {
        userPrompt = `请将以下文本翻译成中文：\n\n${text}`;
      } else if (targetLang === 'en') {
        userPrompt = `请将以下文本翻译成英文：\n\n${text}`;
      } else if (targetLang === 'ja') {
        userPrompt = `请将以下文本翻译成日文：\n\n${text}`;
      } else {
        userPrompt = `请将以下文本翻译成${targetLang}：\n\n${text}`;
      }
      
      // 调用Kimi API
      const response = await fetch(CONFIG.ENDPOINTS.TRANSLATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: CONFIG.MODEL,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.3
        })
      });
      
      console.log('Kimi API响应状态:', response.status);
      
      if (!response.ok) {
        console.error('Kimi API请求失败:', await response.text());
        return `翻译失败 (错误代码: ${response.status})，请检查API密钥或网络连接`;
      }
      
      const data = await response.json();
      console.log('Kimi API响应数据结构:', data ? '已接收' : '未接收');
      
      if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        const translatedText = data.choices[0].message.content.trim();
        
        // 保存到历史记录
        saveHistory(text, translatedText, 'translate', targetLang, Date.now());
        
        return `【Kimi翻译】\n${translatedText}`;
      } else {
        console.error('Kimi API响应格式不正确:', data);
        return '翻译失败，API响应格式不正确';
      }
    } catch (error) {
      console.error('翻译错误:', error);
      return `翻译过程中出现错误: ${error.message || '未知错误'}`;
    }
  }
  
  // 使用Kimi API总结内容
  async function summarizeText(text, summaryType, language) {
    console.log(`开始总结文本，总结类型: ${summaryType}, 语言: ${language}, 文本长度: ${text.length}`);
    if (!text) {
      console.log('无文本可总结');
      return '请先选择或输入要总结的文本';
    }
    
    try {
      console.log(`准备调用Kimi API总结，文本长度: ${text.length}, 总结类型: ${summaryType}`);
      
      // 构建提示词
      let systemPrompt = '你是一个专业的文本总结助手，请根据用户的需求总结文本内容，保持清晰简洁。请处理最多20000个字符的长文本。';
      let userPrompt = '';
      
      // 根据语言和总结长度构建提示词
      let languageDesc = '';
      if (language === 'zh') {
        languageDesc = '中文';
      } else if (language === 'en') {
        languageDesc = '英文';
      } else if (language === 'ja') {
        languageDesc = '日文';
      }
      
      if (summaryType === 'short') {
        userPrompt = `请用${languageDesc}对以下文本进行简短总结（50字以内）：\n\n${text}`;
      } else if (summaryType === 'medium') {
        userPrompt = `请用${languageDesc}对以下文本进行中等长度的总结（100-200字）：\n\n${text}`;
      } else if (summaryType === 'long') {
        userPrompt = `请用${languageDesc}对以下文本进行详细总结（300字左右），包括主要观点和重要细节：\n\n${text}`;
      } else {
        userPrompt = `请用${languageDesc}总结以下文本：\n\n${text}`;
      }
      
      // 调用Kimi API
      const response = await fetch(CONFIG.ENDPOINTS.SUMMARIZE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: CONFIG.MODEL,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.3
        })
      });
      
      console.log('Kimi API响应状态:', response.status);
      
      if (!response.ok) {
        console.error('Kimi API请求失败:', await response.text());
        return `总结失败 (错误代码: ${response.status})，请检查API密钥或网络连接`;
      }
      
      const data = await response.json();
      console.log('Kimi API响应数据结构:', data ? '已接收' : '未接收');
      
      if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        const summaryText = data.choices[0].message.content.trim();
        
        // 保存到历史记录
        saveHistory(text, summaryText, 'summarize', language, Date.now(), { summaryType });
        
        return `【Kimi总结】\n${summaryText}`;
      } else {
        console.error('Kimi API响应格式不正确:', data);
        return '总结失败，API响应格式不正确';
      }
    } catch (error) {
      console.error('总结错误:', error);
      return `总结过程中出现错误: ${error.message || '未知错误'}`;
    }
  }
  
  // 获取整个网页内容
  async function getPageContent() {
    console.log('获取整个网页内容');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        console.error('无法获取当前标签页');
        return { error: '无法获取当前标签页' };
      }
      
      console.log('当前标签页ID:', tab.id);
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' });
        console.log('获取到网页内容响应:', response ? `标题: ${response.title}, 内容长度: ${response.text ? response.text.length : 0}` : '无响应');
        return response || { error: '无法获取网页内容' };
      } catch (error) {
        console.error('发送消息到内容脚本失败:', error);
        
        // 尝试注入内容脚本后重试
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          console.log('内容脚本已注入，重试获取网页内容');
          
          // 短暂延迟后重试
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const retryResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' });
          return retryResponse || { error: '无法获取网页内容' };
        } catch (retryError) {
          console.error('重试获取网页内容失败:', retryError);
          return { error: '无法注入内容脚本获取网页内容' };
        }
      }
    } catch (error) {
      console.error('获取网页内容出错:', error);
      return { error: `获取网页内容出错: ${error.message}` };
    }
  }
  
  // 总结整个网页
  async function summarizeWebPage() {
    loading.classList.remove('hidden');
    resultContainer.innerHTML = '';
    
    // 获取网页内容
    const pageData = await getPageContent();
    
    if (pageData.error || !pageData.text) {
      loading.classList.add('hidden');
      resultContainer.innerHTML = `<p class="placeholder">获取网页内容失败: ${pageData.error || '未知错误'}</p>`;
      
      // 添加处理按钮
      const actionDiv = document.createElement('div');
      actionDiv.className = 'action-button';
      actionDiv.innerHTML = `<button id="process-btn" class="action-btn">重试</button>`;
      resultContainer.appendChild(actionDiv);
      document.getElementById('process-btn').addEventListener('click', summarizeWebPage);
      return;
    }
    
    // 准备总结信息
    let summaryInfo = '';
    if (pageData.title) {
      summaryInfo += `网页标题: ${pageData.title}\n`;
    }
    if (pageData.url) {
      summaryInfo += `网页地址: ${pageData.url}\n`;
    }
    if (pageData.truncated) {
      summaryInfo += `注意: 网页内容过长，已截断，总结可能不完整\n`;
    }
    
    const length = summaryLength.value;
    const language = summaryLanguage.value;
    
    // 记录API调用信息
    const apiInfo = `API调用信息：
- 模式：网页总结
- 使用API：Kimi API (${CONFIG.ENDPOINTS.SUMMARIZE})
- 模型：${CONFIG.MODEL}
- 总结语言：${language}
- 总结类型：${length}
- 网页标题：${pageData.title || '未知'}
- 文本长度：${pageData.text.length}字符${pageData.truncated ? '（已截断）' : ''}`;
    
    // 总结网页内容
    const result = await summarizeText(pageData.text, length, language);
    
    // 保存到历史记录，包含网页信息
    if (!result.includes('总结失败') && !result.includes('出现错误')) {
      saveHistory(
        pageData.text.substring(0, 300) + '...(网页内容已截断)', 
        result, 
        'summarize', 
        language, 
        Date.now(), 
        { 
          title: pageData.title, 
          url: pageData.url, 
          summaryType: length
        }
      );
    }
    
    console.log(`网页总结完成，结果长度: ${result.length}`);
    
    // 显示网页信息
    const infoDiv = document.createElement('div');
    infoDiv.className = 'page-info';
    infoDiv.innerHTML = `<pre>${summaryInfo}</pre>`;
    resultContainer.appendChild(infoDiv);
    
    // 显示结果
    const resultPara = document.createElement('p');
    resultPara.textContent = result;
    resultPara.style.whiteSpace = 'pre-wrap';
    resultContainer.appendChild(resultPara);
    
    // 如果文本较长，添加文本长度信息
    if (pageData.text.length > 5000) {
      const lengthInfo = document.createElement('div');
      lengthInfo.className = 'text-length-info';
      lengthInfo.style.fontSize = '12px';
      lengthInfo.style.color = '#666';
      lengthInfo.style.marginTop = '5px';
      lengthInfo.style.marginBottom = '5px';
      lengthInfo.textContent = `文本长度: ${pageData.text.length.toLocaleString()}字符 ${pageData.text.length > 15000 ? '(较长文本可能会影响处理速度)' : ''}`;
      resultContainer.insertBefore(lengthInfo, resultPara);
    }
    
    // 添加API信息（默认隐藏）
    const apiInfoDiv = document.createElement('div');
    apiInfoDiv.className = 'api-info hidden';
    apiInfoDiv.innerHTML = `<pre>${apiInfo}</pre>`;
    resultContainer.appendChild(apiInfoDiv);
    
    // 添加显示API信息的按钮
    const toggleApiInfoBtn = document.createElement('button');
    toggleApiInfoBtn.className = 'toggle-api-info';
    toggleApiInfoBtn.textContent = '显示API调用信息';
    toggleApiInfoBtn.addEventListener('click', () => {
      const apiInfoDiv = document.querySelector('.api-info');
      if (apiInfoDiv.classList.contains('hidden')) {
        apiInfoDiv.classList.remove('hidden');
        toggleApiInfoBtn.textContent = '隐藏API调用信息';
      } else {
        apiInfoDiv.classList.add('hidden');
        toggleApiInfoBtn.textContent = '显示API调用信息';
      }
    });
    resultContainer.appendChild(toggleApiInfoBtn);
    
    // 添加处理按钮
    const actionDiv = document.createElement('div');
    actionDiv.className = 'action-button';
    actionDiv.innerHTML = `<button id="process-btn" class="action-btn">重新总结</button>`;
    resultContainer.appendChild(actionDiv);
    
    // 重新绑定事件
    document.getElementById('process-btn').addEventListener('click', summarizeWebPage);
    
    loading.classList.add('hidden');
  }
  
  // 更新UI以匹配当前模式
  function updateUI() {
    // 更新功能模式UI（翻译/总结）
    if (activeMode === 'translate') {
      translateBtn.classList.add('active');
      summarizeBtn.classList.remove('active');
      if (historyBtn) historyBtn.classList.remove('active');
      translationOptions.style.display = 'flex';
      summaryOptions.style.display = 'none';
      processBtn.textContent = '翻译文本';
      
      // 更新所有处理按钮
      const allProcessBtns = document.querySelectorAll('.action-btn');
      allProcessBtns.forEach(btn => {
        if (btn.id === 'process-btn' || btn.classList.contains('process-btn')) {
          btn.textContent = '翻译文本';
        }
      });
    } else if (activeMode === 'summarize') {
      summarizeBtn.classList.add('active');
      translateBtn.classList.remove('active');
      if (historyBtn) historyBtn.classList.remove('active');
      translationOptions.style.display = 'none';
      summaryOptions.style.display = 'flex';
      processBtn.textContent = '总结文本';
      
      // 更新所有处理按钮
      const allProcessBtns = document.querySelectorAll('.action-btn');
      allProcessBtns.forEach(btn => {
        if (btn.id === 'process-btn' || btn.classList.contains('process-btn')) {
          btn.textContent = '总结文本';
        }
      });
    }
    
    // 更新输入模式UI（选择/输入）
    if (inputMode === 'select') {
      selectTab.classList.add('active');
      inputTab.classList.remove('active');
      textInputContainer.classList.add('hidden');
      
      // 显示总结整个网页按钮（在选择文本模式下）
      if (document.getElementById('summarize-page-container')) {
        document.getElementById('summarize-page-container').style.display = 'block';
      }
    } else {
      inputTab.classList.add('active');
      selectTab.classList.remove('active');
      textInputContainer.classList.remove('hidden');
      
      // 隐藏总结整个网页按钮（在输入文本模式下）
      if (document.getElementById('summarize-page-container')) {
        document.getElementById('summarize-page-container').style.display = 'none';
      }
    }
    
    // 显示标签切换区域
    const tabsElem = document.querySelector('.tabs');
    if (tabsElem) tabsElem.style.display = 'flex';
    
    // 清除结果区域并显示提示信息
    resultContainer.innerHTML = '<p class="placeholder">请选择或输入要' + (activeMode === 'translate' ? '翻译' : '总结') + '的文本</p>';
    
    // 添加处理按钮
    const actionDiv = document.createElement('div');
    actionDiv.className = 'action-button';
    actionDiv.innerHTML = `<button id="process-btn" class="action-btn">${activeMode === 'translate' ? '翻译文本' : '总结文本'}</button>`;
    resultContainer.appendChild(actionDiv);
    
    // 重新绑定事件
    document.getElementById('process-btn').addEventListener('click', processText);
  }
  
  // 获取当前处理文本
  async function getCurrentText() {
    let text = '';
    
    if (inputMode === 'select') {
      // 从网页选择的文本
      text = await getSelectedText();
    } else {
      // 从输入框的文本
      text = inputText.value.trim();
    }
    
    return text;
  }
  
  // 处理文本（根据当前模式选择翻译或总结）
  async function processText() {
    const text = await getCurrentText();
    
    console.log(`开始处理文本，模式: ${activeMode}, 文本长度: ${text ? text.length : 0}`);
    if (!text) {
      console.log('无文本可处理');
      resultContainer.innerHTML = '<p class="placeholder">请先选择或输入要处理的文本</p>';
      
      // 添加处理按钮
      const actionDiv = document.createElement('div');
      actionDiv.className = 'action-button';
      actionDiv.innerHTML = `<button id="process-btn" class="action-btn">${activeMode === 'translate' ? '翻译文本' : '总结文本'}</button>`;
      resultContainer.appendChild(actionDiv);
      
      // 重新绑定事件
      document.getElementById('process-btn').addEventListener('click', processText);
      
      return;
    }
    
    loading.classList.remove('hidden');
    resultContainer.innerHTML = '';
    
    let result = '';
    let apiInfo = '';
    
    if (activeMode === 'translate') {
      console.log('执行翻译操作');
      const lang = targetLanguage.value;
      
      // 记录API调用信息
      apiInfo = `API调用信息：
- 模式：翻译
- 使用API：Kimi API (${CONFIG.ENDPOINTS.TRANSLATE})
- 模型：${CONFIG.MODEL}
- 源语言：自动检测
- 目标语言：${lang}
- 文本长度：${text.length}字符`;
      
      result = await translateText(text, lang);
    } else if (activeMode === 'summarize') {
      console.log('执行总结操作');
      const length = summaryLength.value;
      const language = summaryLanguage.value;
      
      // 记录API调用信息
      apiInfo = `API调用信息：
- 模式：总结
- 使用API：Kimi API (${CONFIG.ENDPOINTS.SUMMARIZE})
- 模型：${CONFIG.MODEL}
- 总结语言：${language}
- 总结类型：${length}
- 文本长度：${text.length}字符`;
      
      result = await summarizeText(text, length, language);
    }
    
    console.log(`处理完成，结果长度: ${result.length}`);
    
    // 显示结果
    const resultPara = document.createElement('p');
    resultPara.textContent = result;
    resultPara.style.whiteSpace = 'pre-wrap';
    resultContainer.appendChild(resultPara);
    
    // 如果文本较长，添加文本长度信息
    if (text.length > 5000) {
      const lengthInfo = document.createElement('div');
      lengthInfo.className = 'text-length-info';
      lengthInfo.style.fontSize = '12px';
      lengthInfo.style.color = '#666';
      lengthInfo.style.marginTop = '5px';
      lengthInfo.style.marginBottom = '5px';
      lengthInfo.textContent = `文本长度: ${text.length.toLocaleString()}字符 ${text.length > 15000 ? '(较长文本可能会影响处理速度)' : ''}`;
      resultContainer.insertBefore(lengthInfo, resultPara);
    }
    
    // 添加API信息（默认隐藏）
    const apiInfoDiv = document.createElement('div');
    apiInfoDiv.className = 'api-info hidden';
    apiInfoDiv.innerHTML = `<pre>${apiInfo}</pre>`;
    resultContainer.appendChild(apiInfoDiv);
    
    // 添加显示API信息的按钮
    const toggleApiInfoBtn = document.createElement('button');
    toggleApiInfoBtn.className = 'toggle-api-info';
    toggleApiInfoBtn.textContent = '显示API调用信息';
    toggleApiInfoBtn.addEventListener('click', () => {
      const apiInfoDiv = document.querySelector('.api-info');
      if (apiInfoDiv.classList.contains('hidden')) {
        apiInfoDiv.classList.remove('hidden');
        toggleApiInfoBtn.textContent = '隐藏API调用信息';
      } else {
        apiInfoDiv.classList.add('hidden');
        toggleApiInfoBtn.textContent = '显示API调用信息';
      }
    });
    resultContainer.appendChild(toggleApiInfoBtn);
    
    // 添加处理按钮
    const actionDiv = document.createElement('div');
    actionDiv.className = 'action-button';
    actionDiv.innerHTML = `<button id="process-btn" class="action-btn">${activeMode === 'translate' ? '重新翻译' : '重新总结'}</button>`;
    resultContainer.appendChild(actionDiv);
    
    // 重新绑定事件
    document.getElementById('process-btn').addEventListener('click', processText);
    
    loading.classList.add('hidden');
  }
  
  // 处理翻译按钮点击
  translateBtn.addEventListener('click', () => {
    console.log('翻译按钮被点击');
    activeMode = 'translate';
    chrome.storage.local.set({ activeMode: 'translate' });
    updateUI();
  });
  
  // 处理总结按钮点击
  summarizeBtn.addEventListener('click', () => {
    console.log('总结按钮被点击');
    activeMode = 'summarize';
    chrome.storage.local.set({ activeMode: 'summarize' });
    updateUI();
  });
  
  // 处理历史记录按钮点击
  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      console.log('侧边栏：历史记录按钮被点击');
      showHistory();
    });
  }
  
  // 处理选择标签点击
  selectTab.addEventListener('click', () => {
    console.log('选择文本标签被点击');
    inputMode = 'select';
    chrome.storage.local.set({ inputMode: 'select' });
    
    // 显示总结整个网页按钮（在选择文本模式下）
    if (document.getElementById('summarize-page-container')) {
      document.getElementById('summarize-page-container').style.display = 'block';
    }
    
    updateUI();
  });
  
  // 处理输入标签点击
  inputTab.addEventListener('click', () => {
    console.log('输入文本标签被点击');
    inputMode = 'input';
    chrome.storage.local.set({ inputMode: 'input' });
    
    // 隐藏总结整个网页按钮（在输入文本模式下）
    if (document.getElementById('summarize-page-container')) {
      document.getElementById('summarize-page-container').style.display = 'none';
    }
    
    updateUI();
    
    // 如果有选中的文本，自动填充到输入框
    getSelectedText().then(text => {
      if (text && !inputText.value) {
        inputText.value = text;
      }
      inputText.focus();
    });
  });
  
  // 处理操作按钮点击
  processBtn.addEventListener('click', processText);
  
  // 处理总结页面按钮点击
  summarizePageBtn.addEventListener('click', summarizeWebPage);
  
  // 初始化: 从存储中恢复设置
  chrome.storage.local.get(['activeMode', 'autoProcess', 'lastMode', 'targetLanguage', 'summaryLength', 'summaryLanguage', 'inputMode', 'inputText'], async (result) => {
    console.log('从存储获取设置:', result);
    
    // 设置活动模式
    if (result.activeMode) {
      activeMode = result.activeMode;
    }
    
    // 设置输入模式
    if (result.inputMode) {
      inputMode = result.inputMode;
    }
    
    // 设置目标语言
    if (result.targetLanguage) {
      targetLanguage.value = result.targetLanguage;
    }
    
    // 设置总结长度
    if (result.summaryLength) {
      summaryLength.value = result.summaryLength;
    }
    
    // 设置总结语言
    if (result.summaryLanguage) {
      summaryLanguage.value = result.summaryLanguage;
    }
    
    // 设置输入文本
    if (result.inputText) {
      inputText.value = result.inputText;
    }
    
    // 确保UI与当前模式一致
    updateUI();
    
    // 检查是否需要自动处理
    if (result.autoProcess) {
      console.log('检测到自动处理标记，模式:', result.lastMode);
      // 清除自动处理标记
      chrome.storage.local.remove('autoProcess');
      
      if (result.lastMode) {
        activeMode = result.lastMode;
        updateUI();
      }
      
      if (inputMode === 'input' && inputText.value) {
        console.log('使用输入框文本进行处理');
        processText();
      } else {
        // 获取选中文本并处理
        selectedText = await getSelectedText();
        if (selectedText) {
          if (inputMode === 'input') {
            inputText.value = selectedText;
          }
          console.log(`自动处理模式下获取到的文本长度: ${selectedText.length}`);
          processText();
        } else {
          console.log('自动处理模式但未获取到文本');
        }
      }
    } else {
      // 不是自动处理模式，也尝试获取文本
      if (inputMode === 'input' && inputText.value) {
        console.log('使用输入框文本进行处理');
        processText();
      } else {
        selectedText = await getSelectedText();
        if (selectedText) {
          if (inputMode === 'input') {
            inputText.value = selectedText;
          }
          console.log(`获取到的文本长度: ${selectedText.length}`);
          processText();
        }
      }
    }
  });
  
  // 监听存储变化，确保UI与当前模式一致
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.activeMode && changes.activeMode.newValue) {
      activeMode = changes.activeMode.newValue;
      updateUI();
    }
  });
  
  // 显示历史记录列表
  function showHistory() {
    console.log('侧边栏：显示历史记录函数被调用');
    
    // 更新按钮状态
    document.getElementById('translate-btn').classList.remove('active');
    document.getElementById('summarize-btn').classList.remove('active');
    document.getElementById('history-btn').classList.add('active');
    
    // 隐藏选项区域
    translationOptions.style.display = 'none';
    summaryOptions.style.display = 'none';
    
    // 隐藏标签切换
    document.querySelector('.tabs').style.display = 'none';
    textInputContainer.classList.add('hidden');
    
    // 清空结果区域并显示历史记录
    resultContainer.innerHTML = '';
    
    // 日志显示当前历史记录数量
    console.log(`侧边栏：准备显示${historyRecords.length}条历史记录`);
    
    // 如果没有历史记录
    if (historyRecords.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'placeholder';
      emptyMsg.textContent = '暂无历史记录';
      resultContainer.appendChild(emptyMsg);
      
      // 添加返回按钮
      const backBtn = document.createElement('button');
      backBtn.className = 'btn';
      backBtn.style.display = 'block';
      backBtn.style.margin = '15px auto';
      backBtn.textContent = '返回';
      backBtn.addEventListener('click', () => {
        // 恢复之前的模式
        if (activeMode === 'translate') {
          translateBtn.click();
        } else {
          summarizeBtn.click();
        }
      });
      resultContainer.appendChild(backBtn);
      
      return;
    }
    
    // 创建历史记录列表
    const historyList = document.createElement('div');
    historyList.className = 'history-list';
    
    // 添加清空历史按钮
    const clearHistoryBtn = document.createElement('button');
    clearHistoryBtn.className = 'btn';
    clearHistoryBtn.textContent = '清空历史';
    clearHistoryBtn.style.margin = '10px auto';
    clearHistoryBtn.style.display = 'block';
    clearHistoryBtn.addEventListener('click', clearHistory);
    resultContainer.appendChild(clearHistoryBtn);
    
    // 添加每条历史记录
    historyRecords.forEach((record, index) => {
      const recordItem = document.createElement('div');
      recordItem.className = 'history-item';
      recordItem.style.padding = '10px';
      recordItem.style.margin = '10px 0';
      recordItem.style.borderBottom = '1px solid #eee';
      
      // 创建记录头部信息
      const recordHeader = document.createElement('div');
      recordHeader.className = 'record-header';
      recordHeader.style.display = 'flex';
      recordHeader.style.justifyContent = 'space-between';
      recordHeader.style.marginBottom = '5px';
      
      // 记录类型和语言
      const recordType = document.createElement('span');
      recordType.className = 'record-type';
      recordType.style.fontWeight = 'bold';
      recordType.textContent = record.mode === 'translate' ? 
        `翻译(${getLanguageName(record.language)})` : 
        `总结(${getLanguageName(record.language)})`;
      
      // 记录时间
      const recordTime = document.createElement('span');
      recordTime.className = 'record-time';
      recordTime.style.color = '#999';
      recordTime.style.fontSize = '12px';
      recordTime.textContent = formatTime(record.timestamp);
      
      recordHeader.appendChild(recordType);
      recordHeader.appendChild(recordTime);
      recordItem.appendChild(recordHeader);
      
      // 如果是网页总结，显示网页信息
      if (record.pageInfo && record.pageInfo.title) {
        const pageInfoDiv = document.createElement('div');
        pageInfoDiv.className = 'page-info';
        pageInfoDiv.style.fontSize = '12px';
        pageInfoDiv.style.color = '#666';
        pageInfoDiv.style.marginBottom = '5px';
        pageInfoDiv.textContent = `网页: ${record.pageInfo.title}`;
        recordItem.appendChild(pageInfoDiv);
      }
      
      // 显示结果内容（有限字数）
      const resultText = document.createElement('div');
      resultText.className = 'result-text';
      resultText.style.fontSize = '14px';
      resultText.style.marginTop = '5px';
      resultText.style.whiteSpace = 'pre-wrap';
      
      // 最多显示100个字符的结果
      const displayText = record.resultText.length > 100 ? 
        record.resultText.substring(0, 100) + '...' : record.resultText;
      resultText.textContent = displayText;
      recordItem.appendChild(resultText);
      
      // 添加"查看详情"按钮
      const viewBtn = document.createElement('button');
      viewBtn.className = 'btn';
      viewBtn.textContent = '查看详情';
      viewBtn.style.marginTop = '5px';
      viewBtn.style.padding = '5px 10px';
      viewBtn.style.fontSize = '12px';
      viewBtn.addEventListener('click', () => viewHistoryDetail(record));
      recordItem.appendChild(viewBtn);
      
      historyList.appendChild(recordItem);
    });
    
    resultContainer.appendChild(historyList);
    
    // 添加返回按钮
    const backBtn = document.createElement('button');
    backBtn.className = 'btn';
    backBtn.style.display = 'block';
    backBtn.style.margin = '15px auto';
    backBtn.textContent = '返回';
    backBtn.addEventListener('click', () => {
      // 恢复之前的模式
      if (activeMode === 'translate') {
        translateBtn.click();
      } else {
        summarizeBtn.click();
      }
    });
    resultContainer.appendChild(backBtn);
  }
  
  // 查看历史记录详情
  function viewHistoryDetail(record) {
    console.log('查看历史记录详情', record.id);
    
    // 清空结果区域
    resultContainer.innerHTML = '';
    
    // 创建详情页面
    const detailContainer = document.createElement('div');
    detailContainer.className = 'history-detail';
    
    // 添加标题
    const detailTitle = document.createElement('h3');
    detailTitle.style.textAlign = 'center';
    detailTitle.style.margin = '10px 0';
    detailTitle.textContent = record.mode === 'translate' ? 
      `翻译记录 (${formatTime(record.timestamp)})` : 
      `总结记录 (${formatTime(record.timestamp)})`;
    detailContainer.appendChild(detailTitle);
    
    // 如果是网页总结，显示网页信息
    if (record.pageInfo && record.pageInfo.title) {
      const pageInfoDiv = document.createElement('div');
      pageInfoDiv.className = 'page-info';
      pageInfoDiv.style.fontSize = '14px';
      pageInfoDiv.style.padding = '10px';
      pageInfoDiv.style.backgroundColor = '#f5f5f5';
      pageInfoDiv.style.borderRadius = '4px';
      pageInfoDiv.style.marginBottom = '15px';
      
      let pageInfoText = `网页标题: ${record.pageInfo.title}\n`;
      if (record.pageInfo.url) {
        pageInfoText += `网页地址: ${record.pageInfo.url}\n`;
      }
      if (record.pageInfo.summaryType) {
        pageInfoText += `总结类型: ${getSummaryTypeName(record.pageInfo.summaryType)}`;
      }
      
      pageInfoDiv.textContent = pageInfoText;
      detailContainer.appendChild(pageInfoDiv);
    }
    
    // 显示结果
    const resultText = document.createElement('div');
    resultText.className = 'result-text';
    resultText.style.whiteSpace = 'pre-wrap';
    resultText.style.padding = '15px';
    resultText.style.backgroundColor = '#fff';
    resultText.style.border = '1px solid #eee';
    resultText.style.borderRadius = '4px';
    resultText.style.marginBottom = '15px';
    resultText.textContent = record.resultText;
    detailContainer.appendChild(resultText);
    
    // 添加操作按钮
    const actionBtns = document.createElement('div');
    actionBtns.className = 'action-buttons';
    actionBtns.style.display = 'flex';
    actionBtns.style.justifyContent = 'space-between';
    
    // 复制按钮
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn';
    copyBtn.textContent = '复制结果';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(record.resultText)
        .then(() => {
          copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = '复制结果'; }, 2000);
        })
        .catch(err => console.error('复制失败:', err));
    });
    actionBtns.appendChild(copyBtn);
    
    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn';
    deleteBtn.textContent = '删除记录';
    deleteBtn.addEventListener('click', () => {
      deleteHistoryRecord(record.id);
      showHistory(); // 刷新历史记录列表
    });
    actionBtns.appendChild(deleteBtn);
    
    detailContainer.appendChild(actionBtns);
    
    // 返回按钮
    const backBtn = document.createElement('button');
    backBtn.className = 'btn';
    backBtn.style.display = 'block';
    backBtn.style.margin = '15px auto';
    backBtn.textContent = '返回历史列表';
    backBtn.addEventListener('click', showHistory);
    detailContainer.appendChild(backBtn);
    
    resultContainer.appendChild(detailContainer);
  }
  
  // 删除单条历史记录
  function deleteHistoryRecord(recordId) {
    console.log('删除历史记录', recordId);
    historyRecords = historyRecords.filter(record => record.id !== recordId);
    chrome.storage.local.set({ historyRecords: historyRecords }, () => {
      console.log('历史记录已删除，当前共有', historyRecords.length, '条记录');
    });
  }
  
  // 清空所有历史记录
  function clearHistory() {
    console.log('清空历史记录');
    if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
      historyRecords = [];
      chrome.storage.local.set({ historyRecords: [] }, () => {
        console.log('所有历史记录已清空');
        showHistory(); // 刷新显示
      });
    }
  }
  
  // 格式化时间戳为可读时间
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  // 获取语言名称
  function getLanguageName(langCode) {
    const langMap = {
      'zh': '中文',
      'en': '英语',
      'ja': '日语'
    };
    return langMap[langCode] || langCode;
  }
  
  // 获取总结类型名称
  function getSummaryTypeName(type) {
    const typeMap = {
      'short': '简短总结',
      'medium': '中等长度',
      'long': '详细总结'
    };
    return typeMap[type] || type;
  }
  
  // 初始化加载历史记录
  loadHistory();
}); 
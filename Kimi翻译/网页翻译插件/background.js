// 插件安装或更新时初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('网页翻译插件已安装或更新');
  
  // 保存配置到存储中供内容脚本使用
  chrome.storage.local.set({
    maxTextLength: CONFIG?.MAX_TEXT_LENGTH || 20000
  }, () => {
    console.log('最大文本长度配置已保存到存储');
  });
  
  // 初始化历史记录
  chrome.storage.local.get(['historyRecords'], (result) => {
    if (!result.historyRecords) {
      chrome.storage.local.set({ historyRecords: [] }, () => {
        console.log('初始化历史记录');
      });
    }
  });
  
  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'translateSelection',
    title: '翻译选中文本',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'summarizeSelection',
    title: '总结选中文本',
    contexts: ['selection']
  });
});

// 监听内容脚本就绪消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'contentScriptReady') {
    console.log('收到内容脚本就绪消息，来自标签页:', sender.tab.id);
    sendResponse({ received: true });
  }
  
  // 处理历史记录相关消息
  if (request.action === 'saveHistory') {
    console.log('收到保存历史记录请求');
    
    chrome.storage.local.get(['historyRecords'], (result) => {
      let historyRecords = result.historyRecords || [];
      
      // 添加新记录
      historyRecords.unshift(request.historyItem);
      
      // 限制数量
      if (historyRecords.length > 50) {
        historyRecords = historyRecords.slice(0, 50);
      }
      
      // 保存回存储
      chrome.storage.local.set({ historyRecords: historyRecords }, () => {
        console.log('历史记录已保存');
        sendResponse({ success: true });
      });
    });
    
    return true; // 异步响应
  }
  
  return true;
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('右键菜单点击:', info.menuItemId);
  
  // 保存选中模式
  let mode = 'translate';
  
  if (info.menuItemId === 'translateSelection') {
    mode = 'translate';
  } else if (info.menuItemId === 'summarizeSelection') {
    mode = 'summarize';
  }
  
  // 保存当前活动模式
  chrome.storage.local.set({ activeMode: mode });
  
  // 打开侧边栏
  console.log('尝试打开侧边栏');
  try {
    chrome.sidePanel.open({ tabId: tab.id }).then(() => {
      console.log('侧边栏已打开');
      
      // 通知内容脚本已经打开了侧边栏
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'openSidePanelWithSelection',
          mode: mode
        }).then(response => {
          console.log('内容脚本响应:', response);
        }).catch(error => {
          console.error('发送消息到内容脚本失败:', error);
        });
      }, 500); // 给侧边栏一些加载时间
    }).catch(error => {
      console.error('打开侧边栏失败:', error);
    });
  } catch (error) {
    console.error('尝试打开侧边栏时出错:', error);
  }
});

// 处理工具栏图标点击
chrome.action.onClicked.addListener((tab) => {
  console.log('插件图标被点击');
  
  // 保存默认为翻译模式
  chrome.storage.local.set({ 
    activeMode: 'translate',
    autoProcess: true,
    lastMode: 'translate'
  });
  
  // 打开侧边栏
  console.log('尝试打开侧边栏');
  try {
    chrome.sidePanel.open({ tabId: tab.id }).then(() => {
      console.log('侧边栏已打开');
      
      // 通知内容脚本已经打开了侧边栏并自动翻译选中内容
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'openSidePanelWithSelection',
          mode: 'translate',
          autoProcess: true  // 添加标记，表示自动处理选中内容
        }).then(response => {
          console.log('内容脚本响应:', response);
        }).catch(error => {
          console.error('发送消息到内容脚本失败:', error);
          
          // 如果发送消息失败，可能是因为内容脚本还没有加载
          // 尝试注入内容脚本
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).then(() => {
            console.log('内容脚本已注入');
            
            // 重新尝试发送消息
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, {
                action: 'openSidePanelWithSelection',
                mode: 'translate',
                autoProcess: true
              }).catch(err => console.error('重新发送消息失败:', err));
            }, 500);
          }).catch(err => console.error('注入内容脚本失败:', err));
        });
      }, 500); // 给侧边栏一些加载时间
    }).catch(error => {
      console.error('打开侧边栏失败:', error);
    });
  } catch (error) {
    console.error('尝试打开侧边栏时出错:', error);
  }
}); 
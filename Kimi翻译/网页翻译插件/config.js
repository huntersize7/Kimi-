// Kimi API配置
const CONFIG = {
  // 请替换为您的实际API密钥
  API_KEY: 'sk-wl8wWZvNYsS4keXlAQbewrEskPmrO82ROe8X1XDcLi2pmlN7',
  
  // 使用的模型
  MODEL: 'moonshot-v1-8k',
  
  // 文本处理长度限制
  MAX_TEXT_LENGTH: 20000,
  
  // API端点
  ENDPOINTS: {
    TRANSLATE: 'https://api.moonshot.cn/v1/chat/completions',
    SUMMARIZE: 'https://api.moonshot.cn/v1/chat/completions'
  },
  
  // 默认目标语言
  DEFAULT_TARGET_LANGUAGE: 'zh-CN',
};

// 导出配置
if (typeof module !== 'undefined') {
  module.exports = CONFIG;
} 
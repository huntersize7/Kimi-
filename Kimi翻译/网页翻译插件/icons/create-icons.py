"""
Kimi图标生成器 - 使用Python PIL库调整图片大小并创建不同尺寸的图标
使用方法: 
1. 安装依赖: pip install Pillow
2. 把原始图片放在icons目录下，命名为kimi-original.png
3. 运行此脚本
"""

import os
from PIL import Image

def create_icons():
    # 图标尺寸
    sizes = [16, 32, 48, 128]
    
    # 输入图片路径
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_image_path = os.path.join(script_dir, 'kimi-original.png')
    
    # 检查输入图片是否存在
    if not os.path.exists(input_image_path):
        print(f"错误: 找不到输入图片 {input_image_path}")
        return
    
    try:
        # 打开原始图片
        original_image = Image.open(input_image_path)
        
        # 为每个尺寸创建图标
        for size in sizes:
            # 调整图片大小
            resized_image = original_image.resize((size, size), Image.LANCZOS)
            
            # 保存调整后的图片
            output_path = os.path.join(script_dir, f'icon-{size}.png')
            resized_image.save(output_path)
            print(f"已创建 {size}x{size} 图标: {output_path}")
        
        print("所有图标创建完成!")
    
    except Exception as e:
        print(f"创建图标时出错: {e}")

if __name__ == '__main__':
    create_icons() 
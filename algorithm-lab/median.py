import numpy as np

def median_filter(x, window): # x为输入信号，window为滤波器窗宽，也即平均的点数
    half = window // 2
    # 半径
    y = np.zeros_like(x, dtype=np.float64)
    # 创建全0数组，与输入信号长度相同

    for i in range(len(x)):
        left = max(0, i - half)
        # 左侧不越界
        right = min(len(x), i + half + 1)
        # 右侧不越界
        y[i] = np.median(x[left:right])
        # 计算中位数
        
    return y

window = 5

# 参数可更改

# 本滤波器主要针对脉冲杂波（毛刺）
# 参数越高，滤波效果越强，但会导致信号失真程度增加

y_processed = median_filter(y_noise, window)
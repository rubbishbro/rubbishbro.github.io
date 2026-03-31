import numpy as np

def median_filter(x, window): # x为输入信号，window为滤波器窗宽，也即平均的点数
    half = window // 2
    y = np.zeros_like(x, dtype=np.float64)

    for i in range(len(x)):
        left = max(0, i - half)
        right = min(len(x), i + half + 1)
        y[i] = np.median(x[left:right])
        
    return y

window = 5
y_processed = median_filter(y_noise, window)
import numpy as np

# 此处是正常情况下数据的导入，此处为节省环境，内部已做适配，故略去
# import pandas as pd
# import matplotlib.pyplot as plt

# data = pd.read_csv('data.csv')
# t = data["t"].to_numpy()
# y_noise = data["y_noise"].to_numpy()

def fir_filter(x, window): 
    # x为输入信号，window为滤波器窗宽，也即平均的点数
    half = window // 2
    # 半径
    y = np.zeros_like(x, dtype=np.float64)
    # 创建全0数组，与输入信号长度相同

    for i in range(len(x)):
        left = max(0, i - half)
        # 左侧不越界
        right = min(len(x), i + half + 1)
        # 右侧不越界
        y[i] = np.mean(x[left:right])
        # 计算均值（系数平均的FIR滤波器）
    
    return y

# t, y_noise 已经在全局环境准备好

window = 15 # 参数可更改

# 本滤波器主要针对高频噪声
# 参数越高，滤波效果越强，但会导致信号失真程度增加

y_processed = fir_filter(y_noise, window)


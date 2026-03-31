import numpy as np

# import pandas as pd
# import matplotlib.pyplot as plt

# data = pd.read_csv('data.csv')
# t = data["t"].to_numpy()
# y_noise = data["y_noise"].to_numpy()

def fir_filter(x, window): # x为输入信号，window为滤波器窗宽，也即平均的点数
    half = window // 2
    y = np.zeros_like(x, dtype=np.float64)

    for i in range(len(x)):
        left = max(0, i - half)
        right = min(len(x), i + half + 1)
        y[i] = np.mean(x[left:right])
    
    return y

# t, y_noise 已经在全局环境准备好
# FIR滑动平均：设定窗宽 M
window = 15
y_processed = fir_filter(y_noise, window)


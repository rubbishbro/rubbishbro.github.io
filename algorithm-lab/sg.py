import numpy as np

def savgol_filter(x, window, polyorder):
    M = window // 2
    k = np.arange(-M, M + 1,dtype=np.float64)

    # 构造 Vandermonde 矩阵
    A = np.vstack([k**i for i in range(polyorder + 1)]).T

    # 只取中间一行的系数
    e = np.zeros(polyorder + 1)
    e[0] = 1

    h = e @ np.linalg.inv(A.T @ A) @ A.T # 计算滤波器系数
    y = np.convolve(x, h, mode='same')
    return y

# t, y_noise 已经在全局环境准备好
# y_noise 为含有随机高频噪声和脉冲杂波的输入信号
# 输出变量必须命名为 y_processed
# 对于 SG 滤波：window_length (窗宽)必须为奇数，polyorder 为多项式拟合阶数

y_processed = savgol_filter(y_noise, window=21, polyorder=3)

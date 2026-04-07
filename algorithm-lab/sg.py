import numpy as np

def savgol_filter(x, window, polyorder):
    M = window // 2
    # 半径
    k = np.arange(-M, M + 1,dtype=np.float64)
    # 创建对称的窗口索引数组

    # 构造 Vandermonde 矩阵
    A = np.vstack([k**i for i in range(polyorder + 1)]).T

    # 线性代数A^T A 的逆矩阵乘以 A^T 的第一个单位向量，得到FIR滤波器系数
    e = np.zeros(polyorder + 1)
    e[0] = 1

    h = e @ np.linalg.inv(A.T @ A) @ A.T # 计算滤波器系数
    y = np.convolve(x, h, mode='same')
    # 卷积求解
    return y

# t, y_noise 已经在全局环境准备好
# 输出变量必须命名为 y_processed
# 对于 SG 滤波：window_length (窗宽)必须为奇数，polyorder 为多项式拟合阶数

window = 21 # 必须为奇数
polyorder = 3 # 必须小于 window_length
# 参数可更改

# 本滤波器主要针对高频噪声进行平滑，同时能较好地保留信号的边缘特征
# window越高，滤波效果越强，但会导致信号失真程度增加
# polyorder越高，拟合能力越强，但可能会引入过拟合，导致滤波效果变差
# 详见rubbishbro.github.io/2025/11/20/CMSIS/#SG%E6%BB%A4%E6%B3%A2
y_processed = savgol_filter(y_noise, window, polyorder)

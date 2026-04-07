# 多元散射校正 (Multiplicative Scatter Correction, MSC)
# 光谱中最常见的数据预处理方法，消除不均匀散射颗粒带来的加性或乘性影响
import numpy as np

# y_noise 是多组光谱数据矩阵 (samples x wavelengths)
# 您需要计算出均值光谱，并每条光谱对其进行线性回归校正
# 此处的默认值直接透传

y_processed = y_noise # 请将 y_processed 替换为您手写的 MSC 运算矩阵
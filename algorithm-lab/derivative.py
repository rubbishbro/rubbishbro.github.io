# 导数特征增强 (Derivative Enhancement)
# 用于分离重叠峰并消除基线平移漂移影响的光谱增强利器
import numpy as np
from common import savgol_filter_manual

# y_noise 是信号或光谱
# 最简单直接的是一阶差分或二阶差分，实际工程中常常结合 SG 平滑滤波同时求解导数

def derivative_enhancement(y_noise):
    # 求取一阶差分，并利用 np.append 补齐因差分损失的数据点
    first_derivative = np.diff(y_noise)
    y = np.append(first_derivative, first_derivative[-1])
    return y


def two_order_derivative_enhancement(y_noise):
    # 求取二阶差分，并利用 np.append 补齐因差分损失的数据点
    second_derivative = np.diff(y_noise, n=2)
    y = np.append(second_derivative, [second_derivative[-1], second_derivative[-1]])
    return y

y = savgol_filter_manual(y_noise, window=21, polyorder=3) # 先进行 SG 平滑，参数可更改
y_processed = derivative_enhancement(y)
# y_processed = two_order_derivative_enhancement(y_noise)
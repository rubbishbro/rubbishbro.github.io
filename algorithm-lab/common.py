import numpy as np


def fir_filter(x, window):
	half = window // 2
	y = np.zeros_like(x, dtype=np.float64)
	for i in range(len(x)):
		left = max(0, i - half)
		right = min(len(x), i + half + 1)
		y[i] = np.mean(x[left:right])
	return y


def median_filter(x, window):
	half = window // 2
	y = np.zeros_like(x, dtype=np.float64)
	for i in range(len(x)):
		left = max(0, i - half)
		right = min(len(x), i + half + 1)
		y[i] = np.median(x[left:right])
	return y


def savgol_filter_manual(x, window, polyorder):
	m = window // 2
	k = np.arange(-m, m + 1, dtype=np.float64)
	a = np.vstack([k ** i for i in range(polyorder + 1)]).T
	e = np.zeros(polyorder + 1)
	e[0] = 1.0
	h = e @ np.linalg.inv(a.T @ a) @ a.T
	return np.convolve(x, h, mode='same')


def zscore_normalize(x):
	arr = np.asarray(x, dtype=np.float64)
	mean = np.mean(arr)
	std = np.std(arr)
	if std == 0:
		return np.zeros_like(arr)
	return (arr - mean) / std


def first_derivative(x):
	return np.gradient(np.asarray(x, dtype=np.float64))


def second_derivative(x):
	return np.gradient(np.gradient(np.asarray(x, dtype=np.float64)))

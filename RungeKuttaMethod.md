
# Gravitational acceleration

$x$ is a position vector here.

$$
f(x) = -\frac{x}{|x|^3}
$$


Newton equation

$$
\frac{d^2 x}{dt^2} = f(x) = -\frac{x}{|x|^3}
$$

Define an intermediate variable to make it first-order differetial equation $ v \equiv \frac{dx}{dt} $

$$
\frac{dv}{dt} = -\frac{x}{|x|^3} \\
\frac{dx}{dt} = v
$$

Make the differential deltas

$$
\Delta v = \frac{x}{|x|^3} \Delta t \\
\Delta x = v \Delta t
$$

# Euler method

Formal definition:

$$
x_{n+1} = x_n + hf'(t_n, x_n)
$$

In our case:

$$
v_{n+1} = v_n + h \frac{x}{|x|^3} \\
x_{t+1} = x_n + h v(t)
$$


# Modified Euler method (Midpoint method or Second-order Runge Kutta method)

Formal definition:

$$
\begin{align*}
k_1 &= h f'(t_n, x_n) \\
k_2 &= h f'(t_n + \frac 12 h, x_n + \frac 12 k_1) \\
x_{n+1} &= x_n + k_2
\end{align*}
$$

In our case:

$$
\begin{align*}
\Delta v_1 &= h f(x) \\
\Delta x_1 &= h v(t) \\
\Delta v_2 &= h f(x + \Delta x_1 / 2) \\
\Delta x_2 &= h (v + \Delta v_1 / 2) \\
v(t+h) &= v(t) + \Delta v_2 \\
x(t+h) &= x(t) + \Delta x_2
\end{align*}
$$
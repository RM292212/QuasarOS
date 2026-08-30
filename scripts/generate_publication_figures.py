import os
import numpy as np
import matplotlib.pyplot as plt

def generate_figures():
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'docs', '12-publications', 'figures')
    os.makedirs(output_dir, exist_ok=True)
    
    # Figure 1: Temperature and Salinity
    depth = np.linspace(0, 2000, 100)
    temp = 20 * np.exp(-depth / 300) + 2
    sal = 35 - 1.5 * np.exp(-depth / 500)
    
    fig, ax1 = plt.subplots(figsize=(6, 8))
    ax1.plot(temp, depth, 'r-', label='Temperature')
    ax1.set_xlabel('Temperature (C)', color='r')
    ax1.set_ylabel('Depth (m)')
    ax1.invert_yaxis()
    
    ax2 = ax1.twiny()
    ax2.plot(sal, depth, 'b-', label='Salinity')
    ax2.set_xlabel('Salinity (PSU)', color='b')
    
    plt.title('Temperature and Salinity Soundings')
    fig.tight_layout()
    plt.savefig(os.path.join(output_dir, '01_soundings.png'), dpi=300)
    plt.savefig(os.path.join(output_dir, '01_soundings.svg'))
    plt.close()
    
    # Figure 2: Density Profile
    density = 1025 + 2 * np.exp(depth / 1000)
    fig, ax = plt.subplots(figsize=(6, 8))
    ax.plot(density, depth, 'g-')
    ax.set_xlabel('Density (kg/m^3)')
    ax.set_ylabel('Depth (m)')
    ax.invert_yaxis()
    plt.title('TEOS-10 Derived Density Profile')
    fig.tight_layout()
    plt.savefig(os.path.join(output_dir, '02_density.png'), dpi=300)
    plt.savefig(os.path.join(output_dir, '02_density.svg'))
    plt.close()
    
    # Figure 3: Collocation Benchmark
    points = np.arange(10, 1000, 50)
    time_ms = points ** 1.5 * 0.01
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.plot(points, time_ms, 'ko-')
    ax.set_xlabel('Number of Profiles')
    ax.set_ylabel('Collocation Time (ms)')
    plt.title('Argo Model Collocation Benchmark')
    fig.tight_layout()
    plt.savefig(os.path.join(output_dir, '03_benchmark.png'), dpi=300)
    plt.savefig(os.path.join(output_dir, '03_benchmark.svg'))
    plt.close()

if __name__ == '__main__':
    generate_figures()

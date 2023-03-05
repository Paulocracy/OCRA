# OCRA - The OCR Assistant

## Installation

### A) Clone this repository

```sh
git clone https://github.com/Paulocracy/OCRA
```

### B) Node.js side

1. If not done yet, install node.js, e.g., from https://nodejs.org/

2. Install and test TypeScript via:

```sh
npm install -g typescript
tsc
```

3. (Optional) Update OCRA's dependencies in its folder through

```sh
cd static
npm i --save @types/socket.io
```

### C) Python side

1. If not done yet, install Anaconda or Miniconda via, e.g., https://www.anaconda.com/products/individual

2. With the terminal inside OCRA's folder, create its anaconda environment:

```sh
conda env create -n ocra -f environment.yml
```

### D) Run OCRA

Now, you can run OCRA through

```sh
conda activate ocra
python run.py
```

### E) Uninstall

If you do not need OCRA anymore, you can delete the conda environment as follows:

```sh
conda env remove -n ocra
```

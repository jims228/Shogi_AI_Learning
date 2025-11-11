# Kifu Files Directory

Place your Kifu files here for batch annotation.

## Supported Formats

- **KIF/KIFU**: Japanese notation files (.kif, .kifu)
- **CSA**: Computer Shogi Association format (.csa) 
- **USI**: Universal Shogi Interface format (.usi)

## Organization

You can organize files in subdirectories:

```
data/kifu/
├── tournaments/
│   ├── game1.kif
│   └── game2.csa
├── training/
│   └── practice.usi
└── wars/
    └── exported_games.kif
```

## Usage

Run batch annotation:

```bash
# Process all files
./scripts/annotate_folder.sh

# Process specific subdirectory
./scripts/annotate_folder.sh --dir data/kifu/tournaments

# Custom engine settings
./scripts/annotate_folder.sh --time 500 --verbose
```

See README_KIFU.md for complete documentation.
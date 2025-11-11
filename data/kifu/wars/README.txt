# Shogi Wars Export Folder

This folder is for manually exported Shogi Wars games.

## Important Notice

**This system does NOT automatically scrape or download games from Shogi Wars.**

For legal and ethical reasons, you must manually export games using Shogi Wars' own export features.

## How to Use

1. **Log into Shogi Wars** using your web browser
2. **Navigate to your game history**
3. **Export individual games** using the site's export functionality
4. **Save exported files** in this folder
5. **Run batch annotation** using the same tools as other Kifu files

## Example Workflow

```bash
# 1. Export games manually from Shogi Wars website
# 2. Save them in this folder
cp ~/Downloads/shogi_wars_*.kif ./

# 3. Process the exported files
cd /home/jimjace/Shogi_AI_Learning
./scripts/annotate_folder.sh --dir data/kifu/wars
```

## File Naming

Consider using descriptive names:
- `player1_vs_player2_2024-11-11.kif`
- `shogi_wars_game_12345.csa`
- `tournament_round1.kifu`

## Supported Formats

- KIF format (.kif, .kifu)
- CSA format (.csa)
- USI format (.usi)

See README_KIFU.md for complete documentation.
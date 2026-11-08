-- Draw icon_fish fish-shell homage (variant A, 32x32) from the row map.
-- Palette chars are the sprites.js palette; no new colours.
local PAL = {}
PAL["O"] = Color(96, 75, 64, 255)
PAL["R"] = Color(230, 107, 82, 255)
PAL["A"] = Color(244, 154, 69, 255)
PAL["Y"] = Color(255, 218, 100, 255)
PAL["C"] = Color(255, 255, 255, 255)
PAL["K"] = Color(69, 65, 74, 255)
local ROWS = {
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "...............RR...............",
  ".......ORRRRRRRRRRO.............",
  ".....ORRRRRRRRRRRRRRO.ORO.......",
  "....OAAAOOOAAAAAAAAAAO.OAAO.....",
  "....OAAOKCCOAAAAAAAAAAO.OAAAO...",
  "...OYYYOKCCOYYYYYYYYYYYOOYYYYO..",
  "...OOYYOCCCOYYYYYYYYYYYOOYYYO...",
  "...KKOYYOOOYYYYYYYYYYYYO........",
  "...KKOAAAAAAAAAAAAAAAAAO........",
  "...OOAAAAAAAAAAAAAAAAAAOOAAAO...",
  "...OAAAAAAAAAAAAAAAAAAAOOAAAAO..",
  "....ORRRRRRRRRRRRRRRRRO.ORRRO...",
  "....ORRRRRRRRRRRRRRRRO.ORRO.....",
  ".....ORRRRRRRRRRRRRRO.ORO.......",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
}
local spr = Sprite(32, 32, ColorMode.RGB)
local img = spr.cels[1].image
for y = 0, 31 do
  local row = ROWS[y + 1]
  for x = 0, 31 do
    local ch = row:sub(x + 1, x + 1)
    if ch ~= "." then img:drawPixel(x, y, PAL[ch]) end
  end
end
spr:saveAs("/home/hatch/workspace/tools/aseprite-mcp-workspace/icon_fish_shell.aseprite")
print("saved icon_fish_shell.aseprite")

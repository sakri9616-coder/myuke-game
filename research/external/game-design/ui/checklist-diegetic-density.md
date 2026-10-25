# Checklist — diegetic & density review for strip/menu UI (ours, after Fagerholt & Lorentzon)

Run on any change that adds, moves, or re-skins a UI element — strip first, menu second.

1. **Classify every element, on purpose.** List the elements touched and mark each: diegetic / spatial / meta / non-diegetic. Strip default = diegetic (in-world object) or spatial (bubbles, hover outline); menu = non-diegetic is fine — it is a management console. An element whose class nobody chose is a smell.
2. **Neutral-state rule.** Critical state must not exist *only* in the menu (canon: menu closed is the game). If the menu shows it, name its strip face — object, bubble, lamp, board — or explicitly accept the exception.
3. **Density count.** One primary action per view/cluster. Count simultaneous interactables in the affected area; high-frequency functions prominent, low-frequency grouped or collapsed (sakuri's iron rule: visuals over text, nothing 煩雑）. If the layout needs a paragraph of explanation, the visual is wrong — redesign the visual.
4. **Affordance before hover.** Does it look clickable at rest — shape, framing, convention? The v2.4.6 hover outline is the backup signal, never the only one. Check at final display size (147px standard), not at authoring size.
5. **Occlusion budget.** On the strip, what does it cover, and does the "don't disturb me" escape (grip/かくす) still hold? New furniture respects the strip canon limits.
6. **One shipped reference.** Find one real game solving the same element (Game UI Database / course examples). What did they choose, and why is ours different? "No reason" means copy theirs.

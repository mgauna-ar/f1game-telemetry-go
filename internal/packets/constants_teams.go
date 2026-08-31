package packets

import "fmt"

// TeamNames maps official EA team ID to human-readable team name.
var TeamNames = map[uint16]string{
	0: "Mercedes", 1: "Ferrari", 2: "Red Bull Racing", 3: "Williams",
	4: "Aston Martin", 5: "Alpine", 6: "RB", 7: "Haas",
	8: "McLaren", 9: "Sauber", 41: "F1 Generic", 104: "F1 Custom Team",
	129: "Konnersport", 142: "APXGP '24", 154: "APXGP '25", 155: "Konnersport '24",
	158: "Art GP '24", 159: "Campos '24", 160: "Rodin Motorsport '24", 161: "AIX Racing '24",
	162: "DAMS '24", 163: "Hitech '24", 164: "MP Motorsport '24", 165: "Prema '24",
	166: "Trident '24", 167: "Van Amersfoort Racing '24", 168: "Invicta '24",
	185: "Mercedes '24", 186: "Ferrari '24", 187: "Red Bull Racing '24", 188: "Williams '24",
	189: "Aston Martin '24", 190: "Alpine '24", 191: "RB '24", 192: "Haas '24",
	193: "McLaren '24", 194: "Sauber '24",
	465: "Art GP '25", 466: "Campos '25", 467: "Rodin Motorsport '25", 468: "AIX Racing '25",
	469: "DAMS '25", 470: "Hitech '25", 471: "MP Motorsport '25", 472: "Prema '25",
	473: "Trident '25", 474: "Van Amersfoort Racing '25", 475: "Invicta '25",
	476: "Mercedes '26", 477: "Ferrari '26", 478: "Red Bull Racing '26", 479: "Williams '26",
	480: "Aston Martin '26", 481: "Alpine '26", 482: "RB '26", 483: "Haas '26",
	484: "McLaren '26", 485: "Audi '26", 486: "Cadillac '26",
}

// TeamColors maps official EA team ID to hex color code.
var TeamColors = map[uint16]string{
	0:   "#00D2BE", // Mercedes
	1:   "#DC0000", // Ferrari
	2:   "#3671C6", // Red Bull Racing
	3:   "#64C4FF", // Williams
	4:   "#229971", // Aston Martin
	5:   "#0090FF", // Alpine
	6:   "#6692FF", // RB
	7:   "#6CD3BF", // Haas
	8:   "#FF8000", // McLaren
	9:   "#002B30", // Sauber
	476: "#00D2BE", // Mercedes '26
	477: "#DC0000", // Ferrari '26
	478: "#3671C6", // Red Bull Racing '26
	479: "#64C4FF", // Williams '26
	480: "#229971", // Aston Martin '26
	481: "#0090FF", // Alpine '26
	482: "#6692FF", // RB '26
	483: "#6CD3BF", // Haas '26
	484: "#FF8000", // McLaren '26
	485: "#C0C0C0", // Audi '26
	486: "#D4AF37", // Cadillac '26
}

// TeamName returns the team name for the given team ID.
func TeamName(id uint16) string {
	if name, ok := TeamNames[id]; ok {
		return name
	}
	return fmt.Sprintf("Team %d", id)
}

// TeamColor returns the hex color string for the given team ID.
func TeamColor(id uint16) string {
	if col, ok := TeamColors[id]; ok {
		return col
	}
	return "#00f2fe"
}

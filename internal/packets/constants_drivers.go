package packets

import "fmt"

// DriverNames maps official EA driver ID to human-readable driver name.
var DriverNames = map[uint16]string{
	0: "Carlos Sainz", 2: "Daniel Ricciardo", 3: "Fernando Alonso", 4: "Felipe Massa",
	7: "Lewis Hamilton", 9: "Max Verstappen", 10: "Nico Hülkenberg", 11: "Kevin Magnussen",
	14: "Sergio Pérez", 15: "Valtteri Bottas", 17: "Esteban Ocon", 19: "Lance Stroll",
	20: "Arron Barnes", 21: "Martin Giles", 22: "Alex Murray", 23: "Lucas Roth",
	24: "Igor Correia", 25: "Sophie Levasseur", 26: "Jonas Schiffer", 27: "Alain Forest",
	28: "Jay Letourneau", 29: "Esto Saari", 30: "Yasar Atiyeh", 31: "Callisto Calabresi",
	32: "Naota Izumi", 33: "Howard Clarke", 34: "Lars Kaufmann", 35: "Marie Laursen",
	36: "Flavio Nieves", 38: "Klimek Michalski", 39: "Santiago Moreno", 40: "Benjamin Coppens",
	41: "Noah Visser", 50: "George Russell", 54: "Lando Norris", 58: "Charles Leclerc",
	59: "Pierre Gasly", 62: "Alexander Albon", 70: "Rashid Nair", 71: "Jack Tremblay",
	77: "Ayrton Senna", 80: "Guanyu Zhou", 83: "Juan Manuel Correa", 90: "Michael Schumacher",
	94: "Yuki Tsunoda", 102: "Aidan Jackson", 109: "Jenson Button", 110: "David Coulthard",
	112: "Oscar Piastri", 113: "Liam Lawson", 116: "Richard Verschoor", 123: "Enzo Fittipaldi",
	125: "Mark Webber", 126: "Jacques Villeneuve", 127: "Callie Mayer", 132: "Logan Sargeant",
	136: "Jack Doohan", 137: "Amaury Cordeel", 138: "Dennis Hauger", 145: "Zane Maloney",
	146: "Victor Martins", 147: "Oliver Bearman", 148: "Jak Crawford", 149: "Isack Hadjar",
	152: "Roman Stanek", 153: "Kush Maini", 156: "Brendon Leigh", 157: "David Tonizza",
	158: "Jarno Opmeer", 159: "Lucas Blakeley", 160: "Paul Aron", 161: "Gabriel Bortoleto",
	162: "Franco Colapinto", 163: "Taylor Barnard", 164: "Joshua Dürksen", 165: "Andrea-Kimi Antonelli",
	166: "Ritomo Miyata", 167: "Rafael Villagómez", 168: "Zak O’Sullivan", 169: "Pepe Martí",
	170: "Sonny Hayes", 171: "Joshua Pearce", 172: "Callum Voisin", 173: "Matías Zagazeta",
	174: "Nikola Tsolov", 175: "Tim Tramnitz", 185: "Luca Cortez", 186: "Luke Browning",
	187: "Cian Shields", 188: "Arvid Lindblad", 189: "Dino Beganovic", 190: "Leonardo Fornaroli",
	191: "Oliver Goethe", 192: "Gabriele Minì", 193: "Sebastián Montoya", 194: "Alexander Dunne",
	195: "Max Esterson", 196: "Sami Meguetounif", 197: "John Bennett",
}

// DriverName returns the driver name for the given driver ID.
func DriverName(id uint16) string {
	if name, ok := DriverNames[id]; ok {
		return name
	}
	return fmt.Sprintf("Driver %d", id)
}

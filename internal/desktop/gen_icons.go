//go:build ignore

// gen_icons writes the app icons (icons/app.ico, icons/app_live.ico) from the dashboard's
// apple-touch-icon.png: every size Windows asks for, area-averaged down from the 180 px source so
// the small tray sizes stay crisp, and the live variant with a status dot. Run it with
// `go generate ./internal/desktop` after the source icon changes and commit the results.
package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"log"
	"math"
	"os"
)

const (
	sourcePNG   = "../../frontend/public/apple-touch-icon.png"
	appICO      = "icons/app.ico"
	appLiveICO  = "icons/app_live.ico"
	icoHeader   = 6
	icoEntry    = 16
	icoTypeIcon = 1
	icoBitDepth = 32
	// icoFullSize is written as 0 in an ICO entry.
	icoFullSize = 256

	// The live dot sits in the bottom-right corner: its radius and the dark ring around it are
	// fractions of the icon size, so it reads the same at 16 px and at 180 px.
	dotRadius = 0.15
	dotRing   = 0.05
	dotInset  = 0.02
	// dotSamples is the supersampling per axis that antialiases the dot's edges.
	dotSamples = 4
)

// The icon sizes Windows picks from: notification area at 100-250% scaling, Explorer views,
// the taskbar and Alt+Tab.
var sizes = []int{16, 20, 24, 32, 40, 48, 64, 128, 180}

var (
	// liveDotColor is --status-success (frontend/src/styles/base/variables.css).
	liveDotColor = color.RGBA{R: 0x10, G: 0xb9, B: 0x81, A: 0xff}
	// dotRingColor is the icon's own dark background, so the dot looks cut into the badge.
	dotRingColor = color.RGBA{R: 0x08, G: 0x09, B: 0x0c, A: 0xff}
)

func main() {
	f, err := os.Open(sourcePNG)
	if err != nil {
		log.Fatal(err)
	}
	src, err := png.Decode(f)
	_ = f.Close()
	if err != nil {
		log.Fatal(err)
	}
	base := image.NewRGBA(src.Bounds())
	draw.Draw(base, base.Bounds(), src, src.Bounds().Min, draw.Src)

	if err := writeICO(appICO, base); err != nil {
		log.Fatal(err)
	}
	live := image.NewRGBA(base.Bounds())
	draw.Draw(live, live.Bounds(), base, image.Point{}, draw.Src)
	drawLiveDot(live)
	if err := writeICO(appLiveICO, live); err != nil {
		log.Fatal(err)
	}
	fmt.Println("wrote", appICO, "and", appLiveICO)
}

// drawLiveDot paints the status dot with its ring over img, antialiased by supersampling.
func drawLiveDot(img *image.RGBA) {
	size := float64(img.Bounds().Dx())
	r := dotRadius * size
	ring := r + dotRing*size
	cx := size - ring - dotInset*size
	cy := cx
	for y := 0; y < img.Bounds().Dy(); y++ {
		for x := 0; x < img.Bounds().Dx(); x++ {
			var inDot, inRing int
			for sy := 0; sy < dotSamples; sy++ {
				for sx := 0; sx < dotSamples; sx++ {
					d := math.Hypot(float64(x)+(float64(sx)+0.5)/dotSamples-cx, float64(y)+(float64(sy)+0.5)/dotSamples-cy)
					switch {
					case d <= r:
						inDot++
					case d <= ring:
						inRing++
					}
				}
			}
			if inDot+inRing == 0 {
				continue
			}
			const total = dotSamples * dotSamples
			px := img.RGBAAt(x, y)
			px = blend(px, dotRingColor, float64(inRing+inDot)/total)
			px = blend(px, liveDotColor, float64(inDot)/total)
			img.SetRGBA(x, y, px)
		}
	}
}

// blend paints opaque colour c over premultiplied dst with coverage a.
func blend(dst, c color.RGBA, a float64) color.RGBA {
	mix := func(d, s uint8) uint8 { return uint8(math.Round(float64(d)*(1-a) + float64(s)*a)) }
	return color.RGBA{R: mix(dst.R, c.R), G: mix(dst.G, c.G), B: mix(dst.B, c.B), A: mix(dst.A, c.A)}
}

// downscale area-averages src into a size x size image (premultiplied, so edges don't darken).
func downscale(src *image.RGBA, size int) *image.RGBA {
	dst := image.NewRGBA(image.Rect(0, 0, size, size))
	scale := float64(src.Bounds().Dx()) / float64(size)
	for y := 0; y < size; y++ {
		y0, y1 := float64(y)*scale, float64(y+1)*scale
		for x := 0; x < size; x++ {
			x0, x1 := float64(x)*scale, float64(x+1)*scale
			var r, g, b, a, weight float64
			for sy := int(y0); float64(sy) < y1; sy++ {
				wy := math.Min(y1, float64(sy+1)) - math.Max(y0, float64(sy))
				for sx := int(x0); float64(sx) < x1; sx++ {
					w := wy * (math.Min(x1, float64(sx+1)) - math.Max(x0, float64(sx)))
					p := src.RGBAAt(sx, sy)
					r += float64(p.R) * w
					g += float64(p.G) * w
					b += float64(p.B) * w
					a += float64(p.A) * w
					weight += w
				}
			}
			dst.SetRGBA(x, y, color.RGBA{
				R: uint8(math.Round(r / weight)), G: uint8(math.Round(g / weight)),
				B: uint8(math.Round(b / weight)), A: uint8(math.Round(a / weight)),
			})
		}
	}
	return dst
}

// writeICO writes img at every size as PNG frames, which Windows reads at any size since Vista.
func writeICO(path string, img *image.RGBA) error {
	frames := make([][]byte, 0, len(sizes))
	for _, size := range sizes {
		var buf bytes.Buffer
		if err := png.Encode(&buf, downscale(img, size)); err != nil {
			return err
		}
		frames = append(frames, buf.Bytes())
	}

	var out bytes.Buffer
	for _, v := range []uint16{0, icoTypeIcon, uint16(len(sizes))} {
		_ = binary.Write(&out, binary.LittleEndian, v)
	}
	offset := icoHeader + icoEntry*len(sizes)
	for i, size := range sizes {
		dim := byte(size)
		if size >= icoFullSize {
			dim = 0
		}
		out.Write([]byte{dim, dim, 0, 0})
		_ = binary.Write(&out, binary.LittleEndian, uint16(1))           // planes
		_ = binary.Write(&out, binary.LittleEndian, uint16(icoBitDepth)) // bits per pixel
		_ = binary.Write(&out, binary.LittleEndian, uint32(len(frames[i])))
		_ = binary.Write(&out, binary.LittleEndian, uint32(offset))
		offset += len(frames[i])
	}
	for _, frame := range frames {
		out.Write(frame)
	}
	return os.WriteFile(path, out.Bytes(), 0o644)
}

package locales

import (
	"strings"
	"sync"
	"testing"
)

func TestNormalizeLocale(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"en", "en"},
		{"es", "es"},
		{"EN", "en"},
		{"ES", "es"},
		{"en-US", "en"},
		{"en-GB", "en"},
		{"es-AR", "es"},
		{"es-ES", "es"},
		{"es-MX", "es"},
		{"es_AR", "es"},
		{"  es-AR  ", "es"},
		{"", ""},
		{"   ", ""},
	}

	for _, tt := range tests {
		got := NormalizeLocale(tt.input)
		if got != tt.expected {
			t.Errorf("NormalizeLocale(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}

func TestResolve(t *testing.T) {
	tests := []struct {
		name         string
		reqLang      string
		fallbackLang string
		persona      string
		expectedCode string
	}{
		{
			name:         "Explicit English",
			reqLang:      "en",
			fallbackLang: "es",
			persona:      "colapinto",
			expectedCode: "en",
		},
		{
			name:         "Explicit Spanish",
			reqLang:      "es",
			fallbackLang: "en",
			persona:      "bono",
			expectedCode: "es",
		},
		{
			name:         "English subtag en-US",
			reqLang:      "en-US",
			fallbackLang: "",
			persona:      "",
			expectedCode: "en",
		},
		{
			name:         "Spanish subtag es-AR",
			reqLang:      "es-AR",
			fallbackLang: "",
			persona:      "",
			expectedCode: "es",
		},
		{
			name:         "Empty reqLang uses fallback Spanish",
			reqLang:      "",
			fallbackLang: "es",
			persona:      "bono",
			expectedCode: "es",
		},
		{
			name:         "Empty reqLang uses fallback English",
			reqLang:      "",
			fallbackLang: "en",
			persona:      "colapinto",
			expectedCode: "en",
		},
		{
			name:         "Empty languages default Colapinto persona to Spanish",
			reqLang:      "",
			fallbackLang: "",
			persona:      "colapinto",
			expectedCode: "es",
		},
		{
			name:         "Empty languages default Bono persona to English",
			reqLang:      "",
			fallbackLang: "",
			persona:      "bono",
			expectedCode: "en",
		},
		{
			name:         "Empty languages default unknown persona to English",
			reqLang:      "",
			fallbackLang: "",
			persona:      "custom",
			expectedCode: "en",
		},
		{
			name:         "Unsupported language tag falls back to English",
			reqLang:      "fr-FR",
			fallbackLang: "de",
			persona:      "colapinto",
			expectedCode: "en",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cat := Resolve(tt.reqLang, tt.fallbackLang, tt.persona)
			if cat == nil {
				t.Fatalf("Resolve(%q, %q, %q) returned nil", tt.reqLang, tt.fallbackLang, tt.persona)
			}
			if cat.LocaleCode() != tt.expectedCode {
				t.Errorf("Resolve(%q, %q, %q).LocaleCode() = %q; want %q",
					tt.reqLang, tt.fallbackLang, tt.persona, cat.LocaleCode(), tt.expectedCode)
			}
		})
	}
}

func TestCatalogMethodsNonEmpty(t *testing.T) {
	catalogs := []PromptCatalog{
		Get("en"),
		Get("es"),
	}

	for _, cat := range catalogs {
		t.Run("Locale_"+cat.LocaleCode(), func(t *testing.T) {
			// Personas
			for _, p := range []string{"bono", "colapinto", "custom", "unknown"} {
				res := cat.PersonaPrompt(p, "")
				if strings.TrimSpace(res) == "" {
					t.Errorf("PersonaPrompt(%q) is empty for locale %s", p, cat.LocaleCode())
				}
			}

			customRes := cat.PersonaPrompt("custom", "Custom prompt line")
			if !strings.Contains(customRes, "Custom prompt line") {
				t.Errorf("PersonaPrompt('custom') didn't retain custom text for locale %s", cat.LocaleCode())
			}

			// Driver Callsign
			if cs := cat.DriverCallsignDirective("Franco"); !strings.Contains(cs, "Franco") {
				t.Errorf("DriverCallsignDirective('Franco') missing name for locale %s", cat.LocaleCode())
			}
			if cs := cat.DriverCallsignDirective(""); cs != "" {
				t.Errorf("DriverCallsignDirective('') expected empty, got %q for locale %s", cs, cat.LocaleCode())
			}

			// Critical radio constraints
			if strings.TrimSpace(cat.CriticalRadioConstraints()) == "" {
				t.Errorf("CriticalRadioConstraints() is empty for locale %s", cat.LocaleCode())
			}

			// Urgencies
			for _, u := range []string{"critical", "high", "relaxed"} {
				if strings.TrimSpace(cat.UrgencyDirective(u)) == "" {
					t.Errorf("UrgencyDirective(%q) is empty for locale %s", u, cat.LocaleCode())
				}
			}

			// Incidents
			for _, inc := range []string{"full_sc", "safety_car", "vsc", "red_flag"} {
				if strings.TrimSpace(cat.IncidentDirective(inc)) == "" {
					t.Errorf("IncidentDirective(%q) is empty for locale %s", inc, cat.LocaleCode())
				}
			}

			// F1 2026 mandate
			if strings.TrimSpace(cat.F12026RegulationMandate()) == "" {
				t.Errorf("F12026RegulationMandate() is empty for locale %s", cat.LocaleCode())
			}

			// Phases
			for _, phase := range []string{"GRID", "RACE_START", "IN_LAP", "POST_RACE"} {
				if strings.TrimSpace(cat.DrivingPhaseDirective(phase)) == "" {
					t.Errorf("DrivingPhaseDirective(%q) is empty for locale %s", phase, cat.LocaleCode())
				}
			}

			// Thermal
			if strings.TrimSpace(cat.ThermalOperatingWindows()) == "" {
				t.Errorf("ThermalOperatingWindows() is empty for locale %s", cat.LocaleCode())
			}
			if strings.TrimSpace(cat.EngineThermalDerateCurve()) == "" {
				t.Errorf("EngineThermalDerateCurve() is empty for locale %s", cat.LocaleCode())
			}

			// Session protocols
			if strings.TrimSpace(cat.SessionProtocolDirective("Qualifying", "Monza", true, false)) == "" {
				t.Errorf("SessionProtocolDirective(Qualifying) is empty for locale %s", cat.LocaleCode())
			}
			if strings.TrimSpace(cat.SessionProtocolDirective("FP1", "Monza", false, true)) == "" {
				t.Errorf("SessionProtocolDirective(Practice) is empty for locale %s", cat.LocaleCode())
			}
			if strings.TrimSpace(cat.SessionProtocolDirective("Race", "Monza", false, false)) == "" {
				t.Errorf("SessionProtocolDirective(Race) is empty for locale %s", cat.LocaleCode())
			}

			// General assistant
			if strings.TrimSpace(cat.GeneralAssistantDirectives()) == "" {
				t.Errorf("GeneralAssistantDirectives() is empty for locale %s", cat.LocaleCode())
			}

			// TTS voices
			voice := cat.DefaultTTSVoice()
			if voice == "" {
				t.Errorf("DefaultTTSVoice() is empty for locale %s", cat.LocaleCode())
			}
			localeTag := cat.DefaultTTSLocale()
			if localeTag == "" {
				t.Errorf("DefaultTTSLocale() is empty for locale %s", cat.LocaleCode())
			}
			pVoice, pTag := cat.DefaultPersonaTTSVoice("bono")
			if pVoice == "" || pTag == "" {
				t.Errorf("DefaultPersonaTTSVoice('bono') empty for locale %s", cat.LocaleCode())
			}
		})
	}
}

func TestConcurrentResolve(t *testing.T) {
	var wg sync.WaitGroup
	langs := []string{"en", "es", "en-US", "es-AR", "fr", ""}
	personas := []string{"bono", "colapinto", "custom"}

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			l := langs[idx%len(langs)]
			p := personas[idx%len(personas)]
			cat := Resolve(l, "", p)
			if cat == nil {
				t.Errorf("concurrent Resolve(%q, %q) returned nil", l, p)
			}
		}(i)
	}
	wg.Wait()
}

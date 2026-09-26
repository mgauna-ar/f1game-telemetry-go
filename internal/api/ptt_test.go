package api

import (
	"encoding/json"
	"testing"

	"github.com/mgauna/f1game-telemetry-go/internal/input"
)

// TestPTTMessagesJSON pins the push-to-talk messages on /ws/engineer, which the dashboard tells
// apart by their type.
func TestPTTMessagesJSON(t *testing.T) {
	mapping := input.Mapping{DeviceType: input.DeviceTypeKeyboard, KeyCode: 20, KeyName: "Caps Lock", DeviceName: "Keyboard"}
	const mappingJSON = `{"device_type":"keyboard","device_index":0,"button_index":0,"key_code":20,"key_name":"Caps Lock","device_name":"Keyboard"}`

	tests := []struct {
		name string
		msg  any
		want string
	}{
		{
			name: "button event",
			msg:  newPTTEventMessage(input.Event{State: "down", Mapping: mapping, Timestamp: 1234}),
			want: `{"type":"ptt_event","state":"down","mapping":` + mappingJSON + `,"timestamp":1234}`,
		},
		{
			name: "learned",
			msg:  PTTLearnedMessage{Type: pttLearnedMessageType, Mapping: mapping},
			want: `{"type":"ptt_learned","mapping":` + mappingJSON + `}`,
		},
		{
			name: "learn timeout",
			msg:  PTTLearnTimeoutMessage{Type: pttLearnTimeoutType},
			want: `{"type":"ptt_learn_timeout"}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := json.Marshal(tt.msg)
			if err != nil {
				t.Fatal(err)
			}
			if string(got) != tt.want {
				t.Errorf("got  %s\nwant %s", got, tt.want)
			}
		})
	}
}

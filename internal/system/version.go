package system

import (
	"regexp"
	"strconv"
	"strings"
)

// CompareSemVer compares two semantic version strings (e.g. "v1.0.0", "v1.0.0-beta.2").
// Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if v1 == v2.
func CompareSemVer(v1, v2 string) int {
	v1 = strings.TrimPrefix(strings.TrimSpace(v1), "v")
	v2 = strings.TrimPrefix(strings.TrimSpace(v2), "v")

	if v1 == v2 {
		return 0
	}

	core1, pre1 := splitVersionAndPre(v1)
	core2, pre2 := splitVersionAndPre(v2)

	// Compare core numeric segments
	nums1 := parseNumbers(core1)
	nums2 := parseNumbers(core2)

	for i := 0; i < 3; i++ {
		n1 := 0
		if i < len(nums1) {
			n1 = nums1[i]
		}
		n2 := 0
		if i < len(nums2) {
			n2 = nums2[i]
		}
		if n1 > n2 {
			return 1
		}
		if n1 < n2 {
			return -1
		}
	}

	// If core versions are identical:
	// 1. Check if either is a git-describe post-release build (e.g. "1.0.1-35-g48f0b96")
	post1 := isPostReleaseBuild(pre1)
	post2 := isPostReleaseBuild(pre2)

	if post1 && !post2 {
		// v1 is a post-release build ahead of v2 -> v1 > v2
		return 1
	}
	if !post1 && post2 {
		// v2 is a post-release build ahead of v1 -> v1 < v2
		return -1
	}
	if post1 && post2 {
		return comparePostRelease(pre1, pre2)
	}

	// 2. Standard SemVer pre-release rules (e.g. beta, rc, alpha)
	// A release WITHOUT a pre-release tag is greater than one WITH a pre-release tag
	if pre1 == "" && pre2 != "" {
		return 1
	}
	if pre1 != "" && pre2 == "" {
		return -1
	}
	if pre1 != "" && pre2 != "" {
		return comparePreRelease(pre1, pre2)
	}

	return 0
}

func isPostReleaseBuild(pre string) bool {
	if pre == "" {
		return false
	}
	// Matches git describe pattern: e.g. "35-g48f0b96", "1-gabc123" or "dev"
	re := regexp.MustCompile(`^\d+-g[0-9a-fA-F]+`)
	return re.MatchString(pre) || strings.HasPrefix(pre, "dev")
}

func comparePostRelease(pre1, pre2 string) int {
	re := regexp.MustCompile(`^(\d+)`)
	m1 := re.FindStringSubmatch(pre1)
	m2 := re.FindStringSubmatch(pre2)
	if len(m1) > 1 && len(m2) > 1 {
		n1, _ := strconv.Atoi(m1[1])
		n2, _ := strconv.Atoi(m2[1])
		if n1 > n2 {
			return 1
		}
		if n1 < n2 {
			return -1
		}
	}
	return strings.Compare(pre1, pre2)
}

func splitVersionAndPre(v string) (core, pre string) {
	if idx := strings.Index(v, "-"); idx != -1 {
		return v[:idx], v[idx+1:]
	}
	return v, ""
}

func parseNumbers(core string) []int {
	parts := strings.Split(core, ".")
	nums := make([]int, 0, len(parts))
	for _, p := range parts {
		if n, err := strconv.Atoi(p); err == nil {
			nums = append(nums, n)
		} else {
			nums = append(nums, 0)
		}
	}
	return nums
}

func comparePreRelease(pre1, pre2 string) int {
	if pre1 == pre2 {
		return 0
	}

	// Extract numeric counter if present (e.g. beta.1 vs beta.2)
	re := regexp.MustCompile(`^([a-zA-Z]+)(?:\.(\d+))?`)
	m1 := re.FindStringSubmatch(pre1)
	m2 := re.FindStringSubmatch(pre2)

	if len(m1) > 1 && len(m2) > 1 {
		name1 := m1[1]
		name2 := m2[1]
		if name1 != name2 {
			return strings.Compare(name1, name2)
		}
		num1, _ := strconv.Atoi(m1[2])
		num2, _ := strconv.Atoi(m2[2])
		if num1 > num2 {
			return 1
		}
		if num1 < num2 {
			return -1
		}
	}

	return strings.Compare(pre1, pre2)
}

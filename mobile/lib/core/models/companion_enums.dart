enum CompanionType { male, female }

enum CharacterEmotion {
  welcome,
  motivate,
  support,
  happy,
  celebrate,
  neutral,
  thinking,
  waiting,
  hint,
  warning,
  correct,
  fastCorrect,
  wrong,
  timeout,
  difficultQuestion,
  readyForChallenge,
  challengeExcited,
  victory,
  defeatSportsmanship,
  revengeChallenge,
  excellentResult,
  mediumResult,
  weakResult,
  weaknessReview,
  recommendedLesson,
  streak,
  achievement,
  teamCelebration,
}

typedef CharacterMood = CharacterEmotion;

enum MotionLevel { full, reduced, disabled }

enum CharacterSize { small, medium, large }

enum CharacterAlignment { center, bottomLeft, bottomRight }

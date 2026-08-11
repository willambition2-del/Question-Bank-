import '../models/companion_enums.dart';

class CompanionContextData {
  final CharacterEmotion emotion;
  final String message;

  const CompanionContextData({required this.emotion, required this.message});
}

abstract final class CompanionContextResolver {
  /// Resolves context data for onboarding or splash welcome screen.
  static CompanionContextData resolveWelcome({required bool isMale}) {
    return CompanionContextData(
      emotion: CharacterEmotion.welcome,
      message: isMale
          ? "أهلاً بك يا بطل! أنا مساعدك العلمي للثانوية العامة."
          : "أهلاً بكِ يا متفوقة! أنا مساعدتكِ العلمية للثانوية العامة.",
    );
  }

  /// Resolves context data for home screen main header.
  static CompanionContextData resolveHomeHeader({
    required String userName,
    required bool isMale,
  }) {
    return CompanionContextData(
      emotion: CharacterEmotion.welcome,
      message: isMale
          ? "مرحباً $userName 👋 استعِد اليوم لتحقيق تفوقك الأكاديمي!"
          : "مرحباً $userName 👋 استعدّي اليوم لتحقيق تفوقكِ الأكاديمي!",
    );
  }

  /// Resolves context data for home motivation card.
  static CompanionContextData resolveHomeMotivation({
    required bool isMale,
    int remainingLessons = 1,
  }) {
    return CompanionContextData(
      emotion: CharacterEmotion.motivate,
      message: isMale
          ? "أنت على الطريق الصحيح يا بطل! بقي لك $remainingLessons درس واحد فقط لإكمال هدف اليوم."
          : "أنتِ على الطريق الصحيح يا متفوقة! بقي لكِ $remainingLessons درس واحد فقط لإكمال هدف اليوم.",
    );
  }

  /// Resolves context data for daily streak accomplishment.
  static CompanionContextData resolveStreak({required int streakDays}) {
    return CompanionContextData(
      emotion: CharacterEmotion.streak,
      message:
          "إنجاز رائع! حافظت على تتابع الدراسية لمدة $streakDays أيام متتالية 🔥",
    );
  }

  /// Resolves context data for quiz item response feedback.
  static CompanionContextData resolveAnswerFeedback({
    required bool isCorrect,
    bool isFast = false,
    required bool isMale,
  }) {
    if (isCorrect) {
      if (isFast) {
        return CompanionContextData(
          emotion: CharacterEmotion.fastCorrect,
          message: "إجابة برقية وسريعة جداً! إتقان ممتاز ⚡",
        );
      }
      return CompanionContextData(
        emotion: CharacterEmotion.correct,
        message: "إجابة صحيحة وممتازة! واصل بنفس القوة 👏",
      );
    }
    return CompanionContextData(
      emotion: CharacterEmotion.support,
      message: isMale
          ? "لا تقلق يا بطل! اقرأ التفسير بتمعن وسنستوعب الفكرة معاً 💡"
          : "لا تقلقي يا متفوقة! اقرئي التفسير بتمعن وسنستوعب الفكرة معاً 💡",
    );
  }

  /// Resolves context data for quiz summary & results screen.
  static CompanionContextData resolveQuizResult({
    required double accuracyPct,
    required bool isMale,
  }) {
    if (accuracyPct >= 85) {
      return CompanionContextData(
        emotion: CharacterEmotion.excellentResult,
        message: isMale
            ? "نتيجة استثنائية وباهرة! تفوق علمي مبهر 🏆"
            : "نتيجة استثنائية وباهرة! تفوق علمي مبهر 🏆",
      );
    } else if (accuracyPct >= 60) {
      return CompanionContextData(
        emotion: CharacterEmotion.mediumResult,
        message:
            "أداء جيد جداً! مع قليل من المراجعة ستصل إلى الدرجة الكاملة 📈",
      );
    } else {
      return CompanionContextData(
        emotion: CharacterEmotion.weakResult,
        message: isMale
            ? "محاولة طيبة يا بطل، سنراجع النقاط الضعيفة وسنتغلب عليها معاً 💪"
            : "محاولة طيبة يا متفوقة، سنراجع النقاط الضعيفة وسنتغلب عليها معاً 💪",
      );
    }
  }

  /// Resolves context data for live challenge entry and waiting lobby.
  static CompanionContextData resolveChallengeLobby({
    required bool isSearching,
    required bool isMale,
  }) {
    if (isSearching) {
      return CompanionContextData(
        emotion: CharacterEmotion.waiting,
        message: "جاري البحث عن منافس مناسب في نفس مستواك الأكاديمي...",
      );
    }
    return CompanionContextData(
      emotion: CharacterEmotion.readyForChallenge,
      message: isMale
          ? "جاهز للمنافسة المباشرة؟ أظهر مهاراتك العلمية الآن ⚔️"
          : "جاهزة للمنافسة المباشرة؟ أظهري مهاراتكِ العلمية الآن ⚔️",
    );
  }

  /// Resolves context data for challenge match outcome (victory / sportsmanship).
  static CompanionContextData resolveMatchOutcome({
    required bool isWinner,
    required bool isMale,
  }) {
    if (isWinner) {
      return CompanionContextData(
        emotion: CharacterEmotion.victory,
        message: isMale
            ? "مبروك الفوز الصريح في المبارزة! انتصار مستحق 👑"
            : "مبروك الفوز الصريح في المبارزة! انتصار مستحق 👑",
      );
    }
    return CompanionContextData(
      emotion: CharacterEmotion.defeatSportsmanship,
      message: isMale
          ? "مبارزة قوية! خسرنا هذه الجولة وستكون العودة أقوى في المبارزة القادمة 🤝"
          : "مبارزة قوية! خسرنا هذه الجولة وستكون العودة أقوى في المبارزة القادمة 🤝",
    );
  }

  /// Resolves context data for question hints.
  static CompanionContextData resolveHint() {
    return const CompanionContextData(
      emotion: CharacterEmotion.hint,
      message:
          "تلميح مساعد: ركز على القوانين والمفاهيم الأساسية لهذه الوحدة 💡",
    );
  }

  /// Resolves context data for weakness review and mistakes screen.
  static CompanionContextData resolveMistakeReview() {
    return const CompanionContextData(
      emotion: CharacterEmotion.weaknessReview,
      message:
          "مراجعة الأخطاء هي السر الأول في الوصول لنسبة 100% في الامتحانات الوزارية 🎯",
    );
  }
}

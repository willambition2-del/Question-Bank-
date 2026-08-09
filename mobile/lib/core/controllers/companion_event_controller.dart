import '../models/companion_enums.dart';

enum CompanionEventType {
  USER_OPEN_APP,
  USER_START_QUIZ,
  USER_SELECT_OPTION,
  USER_CORRECT_ANSWER,
  USER_FAST_CORRECT,
  USER_WRONG_ANSWER,
  USER_TIMEOUT,
  USER_REQUEST_HINT,
  USER_FINISH_QUIZ,
  USER_MASTER_LESSON,
  USER_START_CHALLENGE,
  USER_WIN_CHALLENGE,
  USER_LOSE_CHALLENGE,
  USER_UNLOCK_ACHIEVEMENT,
}

class CompanionEventResult {
  final CharacterEmotion emotion;
  final String
  animationType; // 'fade_slide', 'scale_pop', 'shake', 'celebrate_bounce', 'idle_pulse'
  final String message;
  final Duration duration;

  const CompanionEventResult({
    required this.emotion,
    required this.animationType,
    required this.message,
    required this.duration,
  });
}

abstract final class CompanionEventController {
  /// Processes a user learning event and returns emotion, animation, personalized message, and display duration.
  static CompanionEventResult handleEvent({
    required CompanionEventType event,
    required bool isMale,
    String userName = "أحمد",
    int level = 12,
    int points = 2480,
    int streakDays = 5,
    String subjectName = "الفيزياء",
    int remainingQuestions = 5,
  }) {
    switch (event) {
      case CompanionEventType.USER_OPEN_APP:
        return CompanionEventResult(
          emotion: CharacterEmotion.welcome,
          animationType: 'fade_slide',
          message: isMale
              ? "مرحباً $userName 👋 جاهز لتحقيق هدف اليوم في $subjectName؟"
              : "مرحباً $userName 👋 جاهزة لتحقيق هدف اليوم في $subjectName؟",
          duration: const Duration(seconds: 4),
        );

      case CompanionEventType.USER_START_QUIZ:
        return CompanionEventResult(
          emotion: CharacterEmotion.thinking,
          animationType: 'fade_slide',
          message: isMale
              ? "$userName، بقي لك $remainingQuestions أسئلة للوصول للمستوى ${level + 1} 🎯"
              : "$userName، بقي لكِ $remainingQuestions أسئلة للوصول للمستوى ${level + 1} 🎯",
          duration: const Duration(seconds: 3),
        );

      case CompanionEventType.USER_SELECT_OPTION:
        return CompanionEventResult(
          emotion: CharacterEmotion.thinking,
          animationType: 'idle_pulse',
          message: "فكر ملياً في الاختيار قبل التأكيد النهائي...",
          duration: const Duration(seconds: 2),
        );

      case CompanionEventType.USER_CORRECT_ANSWER:
        return CompanionEventResult(
          emotion: CharacterEmotion.correct,
          animationType: 'scale_pop',
          message: isMale
              ? "ممتاز يا $userName! إجابة دقيقة وصحيحة 🔥"
              : "ممتازة يا $userName! إجابة دقيقة وصحيحة 🔥",
          duration: const Duration(seconds: 3),
        );

      case CompanionEventType.USER_FAST_CORRECT:
        return CompanionEventResult(
          emotion: CharacterEmotion.fastCorrect,
          animationType: 'scale_pop',
          message: "سرعة وإتقان خيالي! استمرار رائع ⚡",
          duration: const Duration(seconds: 3),
        );

      case CompanionEventType.USER_WRONG_ANSWER:
        return CompanionEventResult(
          emotion: CharacterEmotion.support,
          animationType: 'shake',
          message: isMale
              ? "لا مشكلة يا $userName، دعنا نفهم السبب ونراجع التعليل معاً 💡"
              : "لا مشكلة يا $userName، دعنا نفهم السبب ونراجع التعليل معاً 💡",
          duration: const Duration(seconds: 4),
        );

      case CompanionEventType.USER_TIMEOUT:
        return CompanionEventResult(
          emotion: CharacterEmotion.timeout,
          animationType: 'shake',
          message: "انتهى الوقت! حافظ على تركيزك في السؤال التالي ⏱️",
          duration: const Duration(seconds: 3),
        );

      case CompanionEventType.USER_REQUEST_HINT:
        return const CompanionEventResult(
          emotion: CharacterEmotion.hint,
          animationType: 'fade_slide',
          message:
              "تلميح: استرجع المفاهيم الأساسية والقانون الفيزيائي المعني 💡",
          duration: const Duration(seconds: 4),
        );

      case CompanionEventType.USER_FINISH_QUIZ:
        return CompanionEventResult(
          emotion: CharacterEmotion.victory,
          animationType: 'celebrate_bounce',
          message: isMale
              ? "أنهيت الاختبار بنجاح يا $userName! تقدمك رائع 🔥"
              : "أنهيتِ الاختبار بنجاح يا $userName! تقدمكِ رائع 🔥",
          duration: const Duration(seconds: 4),
        );

      case CompanionEventType.USER_MASTER_LESSON:
        return CompanionEventResult(
          emotion: CharacterEmotion.streak,
          animationType: 'celebrate_bounce',
          message: "إتقان كامل 100%! أتقنت جميع مفاهيم $subjectName بنجاح 🎓",
          duration: const Duration(seconds: 4),
        );

      case CompanionEventType.USER_START_CHALLENGE:
        return CompanionEventResult(
          emotion: CharacterEmotion.readyForChallenge,
          animationType: 'scale_pop',
          message: isMale
              ? "استعد للمواجهة المباشرة يا $userName! أنت جاهز للفوز ⚔️"
              : "استعدي للمواجهة المباشرة يا $userName! أنتِ جاهزة للفوز ⚔️",
          duration: const Duration(seconds: 3),
        );

      case CompanionEventType.USER_WIN_CHALLENGE:
        return CompanionEventResult(
          emotion: CharacterEmotion.victory,
          animationType: 'celebrate_bounce',
          message: isMale
              ? "مبروك الفوز الصريح يا بطل! انتصار ساحق 🏆"
              : "مبروك الفوز الصريح يا متفوقة! انتصار ساحق 🏆",
          duration: const Duration(seconds: 4),
        );

      case CompanionEventType.USER_LOSE_CHALLENGE:
        return CompanionEventResult(
          emotion: CharacterEmotion.defeatSportsmanship,
          animationType: 'shake',
          message: "مبارزة قوية! سنعوضها في المواجهة القادمة بكفاءة أكبر 🤝",
          duration: const Duration(seconds: 4),
        );

      case CompanionEventType.USER_UNLOCK_ACHIEVEMENT:
        return CompanionEventResult(
          emotion: CharacterEmotion.achievement,
          animationType: 'celebrate_bounce',
          message: "إنجاز فريد جديد مضاف لسجلك الأكاديمي! 🌟",
          duration: const Duration(seconds: 4),
        );
    }
  }
}

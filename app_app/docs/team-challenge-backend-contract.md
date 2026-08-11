# عقد الـ Backend لتحديات 1v1 و 2v2 الجماعية (Team Challenge Backend Contract)

**التطبيق**: بنك الأسئلة للثالث الثانوي  
**تاريخ التوثيق**: 19 يوليو 2026  
**خاصية الميزة**: `teamChallengeEnabled` (تفعيل عبر Feature Flag)  

---

## 🛰️ 1. نقاط النهاية لخدمات REST (REST API Endpoints)

### `POST /api/v1/challenges/create`
**الوصف**: إنشاء غرفة منافسة جديدة (1v1 أو 2v2).  
**Body**:
```json
{
  "mode": "team_2v2", // 'one_v_one' أو 'team_2v2'
  "subject_id": "sub_physics",
  "unit_id": "unit_2",
  "question_count": 10,
  "difficulty": "medium",
  "timer_per_question": 15
}
```
**Response (201 Created)**:
```json
{
  "challenge_id": "ch_987654",
  "room_code": "YEM2026",
  "mode": "team_2v2",
  "created_by": "user_101",
  "created_at": "2026-07-19T14:00:00Z"
}
```

### `POST /api/v1/challenges/join`
**الوصف**: الانضمام إلى غرفة منافسة بواسطة كود الغرفة.  
**Body**:
```json
{
  "room_code": "YEM2026",
  "team_color": "blue" // 'blue' أو 'gold' (في نمط 2v2)
}
```

### `POST /api/v1/challenges/leave`
**الوصف**: المغادرة من غرفة الانتظار.  

---

## ⚡ 2. أحداث WebSocket / Socket.IO (Real-time Events)

### Events من العميل إلى السيرفر (Client -> Server):
- `join_lobby`: الانضمام إلى الغرفة. `payload: { challenge_id, user_id, team }`
- `set_ready`: تغيير حالة الاستعداد. `payload: { challenge_id, is_ready }`
- `submit_answer`: إرسال إجابة السؤال الحالي. `payload: { challenge_id, question_id, option_id, elapsed_ms }`
- `send_reaction`: إرسال تفاعل شخصية تفاعلي غمز/حماس/تشجيع للزملاء.

### Events من السيرفر إلى العميل (Server -> Client):
- `lobby_updated`: تحديث حالة اللاعبين والانضمام والتجهيز في الفريق الأزرق والذهبي.
- `match_start_countdown`: بدء العد التنازلي للمباراة (3, 2, 1).
- `question_started`: فتح سؤال جديد مع الموعد الزمني.
- `team_score_updated`: تحديث نقاط الفريقين والكومبو التراكمي بدون كشف الإجابات للطرف الآخر.
- `match_completed`: إعلان الفائز بالمباراة وحساب الـ MVP والإنجازات المكتسبة.

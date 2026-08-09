import 'package:flutter_riverpod/flutter_riverpod.dart';

class TabIndexNotifier extends Notifier<int> {
  @override
  int build() => 0;

  void setIndex(int index) {
    state = index;
  }
}

final tabIndexProvider = NotifierProvider<TabIndexNotifier, int>(() {
  return TabIndexNotifier();
});

import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/repositories/providers.dart';
import '../providers/curriculum_provider.dart';

class ResourceCard extends ConsumerStatefulWidget {
  final StudyResource resource;

  const ResourceCard({
    super.key,
    required this.resource,
  });

  @override
  ConsumerState<ResourceCard> createState() => _ResourceCardState();
}

class _ResourceCardState extends ConsumerState<ResourceCard> {
  bool isDownloading = false;
  double downloadProgress = 0.0;
  bool isDownloaded = false;
  String? localFilePath;

  @override
  void initState() {
    super.initState();
    _checkIfDownloaded();
  }

  Future<void> _checkIfDownloaded() async {
    final dir = await getApplicationDocumentsDirectory();
    final path = '${dir.path}/${widget.resource.fileName}';
    final file = File(path);
    if (await file.exists()) {
      setState(() {
        isDownloaded = true;
        localFilePath = path;
      });
    }
  }

  Future<void> _downloadOrOpenFile() async {
    if (isDownloaded && localFilePath != null) {
      // Open file offline
      OpenFilex.open(localFilePath!);
      return;
    }

    // Download file
    try {
      setState(() {
        isDownloading = true;
        downloadProgress = 0.0;
      });

      final dioClient = ref.read(dioClientProvider).dio;
      
      // 1. Get the pre-signed download URL from backend
      final response = await dioClient.get('/study-resources/${widget.resource.id}/download');
      final downloadUrl = response.data['data']['url'];

      // 2. Download the actual file
      final dir = await getApplicationDocumentsDirectory();
      final path = '${dir.path}/${widget.resource.fileName}';

      final dio = Dio();
      await dio.download(
        downloadUrl,
        path,
        onReceiveProgress: (received, total) {
          if (total != -1) {
            setState(() {
              downloadProgress = received / total;
            });
          }
        },
      );

      setState(() {
        isDownloading = false;
        isDownloaded = true;
        localFilePath = path;
      });
      
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم التنزيل بنجاح')),
      );
    } catch (e) {
      setState(() {
        isDownloading = false;
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('خطأ أثناء التنزيل: $e')),
      );
    }
  }

  IconData _getIconForMimeType(String mimeType) {
    if (mimeType.contains('pdf')) return Icons.picture_as_pdf_rounded;
    if (mimeType.contains('word')) return Icons.description_rounded;
    if (mimeType.contains('image')) return Icons.image_rounded;
    return Icons.insert_drive_file_rounded;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.primaryBlue.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(
              _getIconForMimeType(widget.resource.mimeType),
              color: AppColors.primaryBlue,
              size: 32,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.resource.title,
                  style: AppTypography.cardTitle.copyWith(fontWeight: FontWeight.bold),
                ),
                if (widget.resource.description != null && widget.resource.description!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    widget.resource.description!,
                    style: AppTypography.caption,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Text(
                      '${(widget.resource.fileSize / 1024 / 1024).toStringAsFixed(2)} MB',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.primaryBlue,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    const Icon(Icons.download_rounded, size: 14, color: AppColors.darkText),
                    const SizedBox(width: 4),
                    Text(
                      '${widget.resource.downloadCount}',
                      style: AppTypography.caption,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                if (isDownloading)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      LinearProgressIndicator(
                        value: downloadProgress,
                        backgroundColor: AppColors.border,
                        valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primaryBlue),
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'جاري التنزيل ${(downloadProgress * 100).toStringAsFixed(0)}%',
                        style: AppTypography.caption,
                      ),
                    ],
                  )
                else
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _downloadOrOpenFile,
                      icon: Icon(isDownloaded ? Icons.folder_open_rounded : Icons.download_rounded),
                      label: Text(isDownloaded ? 'فتح الملف' : 'تنزيل الملف'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isDownloaded ? AppColors.successGreen : AppColors.primaryBlue,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

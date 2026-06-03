-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('SHORT_FILM', 'FULL_FILM', 'SERIES', 'EPISODE', 'TRAILER', 'COMMERCIAL', 'BRANDING', 'CAMPAIGN', 'CASE_STUDY');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('DRAFT', 'IN_PRODUCTION', 'UPCOMING', 'PUBLISHED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_RELEASE', 'NEW_EPISODE', 'ANNOUNCEMENT', 'WATCH_PROGRESS', 'ACCOUNT', 'SYSTEM', 'SECURITY', 'COMMENT_REPLY', 'COMMENT_REPORT');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'DELETED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "CommentReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE_OR_ABUSE', 'SEXUAL_CONTENT', 'VIOLENCE_OR_THREATS', 'PERSONAL_INFORMATION', 'OTHER');

-- CreateEnum
CREATE TYPE "CommentReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED', 'ACTIONED');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('PAGE_VIEW', 'WORK_VIEW', 'TRAILER_CLICK', 'WATCH_START', 'WATCH_PROGRESS', 'WATCH_COMPLETE', 'EPISODE_START', 'EPISODE_COMPLETE', 'SIGN_IN', 'SIGN_UP', 'SIGN_OUT', 'SAVE_WORK', 'UNSAVE_WORK', 'NOTIFICATION_OPEN', 'SETTINGS_UPDATE', 'CTA_IMPRESSION', 'CTA_SIGNUP', 'PAGE_LEAVE', 'LIKE_WORK', 'UNLIKE_WORK', 'SHARE_WORK');

-- CreateEnum
CREATE TYPE "CtaType" AS ENUM ('RELEASE', 'MORE', 'POST_RELEASE');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('MOBILE', 'TABLET', 'DESKTOP', 'BOT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "DeviceTarget" AS ENUM ('DESKTOP', 'MOBILE', 'BOTH');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'DELETED');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('PASSWORD_RESET', 'WELCOME', 'ACCOUNT', 'NOTIFICATION', 'NEW_RELEASE', 'NEW_EPISODE', 'ADMIN_ALERT', 'SECURITY_ALERT', 'FUTURE_CAMPAIGN', 'ANNOUNCEMENT', 'NOTIFY_ME_FOLLOWUP');

-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('GRAPH', 'SMTP', 'ACS', 'DEV_LOG');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'SUPPRESSED', 'QUEUED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED', 'NEW_DEVICE_LOGIN', 'NEW_LOCATION_LOGIN', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'PASSWORD_CHANGED', 'GOOGLE_SIGN_IN', 'CREDENTIALS_SIGN_IN', 'USER_SUSPENDED', 'USER_UNSUSPENDED', 'USER_DEACTIVATED', 'USER_RESTORED', 'USER_PURGED', 'ROLE_CHANGED', 'ADMIN_SETTING_CHANGED', 'EMAIL_SETTING_CHANGED', 'SECURITY_ALERT_SENT', 'SESSION_REVOKED');

-- CreateEnum
CREATE TYPE "SecuritySeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SecurityAlertStatus" AS ENUM ('OPEN', 'READ', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginProvider" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "welcomeEmailSentAt" TIMESTAMP(3),
    "welcomeNotificationSentAt" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "works" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "WorkType" NOT NULL,
    "status" "WorkStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "posterUrl" TEXT,
    "heroMobileUrl" TEXT,
    "heroDesktopUrl" TEXT,
    "thumbnailUrl" TEXT,
    "trailerUrl" TEXT,
    "videoUrl" TEXT,
    "teaserUrl" TEXT,
    "year" INTEGER,
    "duration" INTEGER,
    "director" TEXT,
    "genre" TEXT,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientName" TEXT,
    "industry" TEXT,
    "projectGoal" TEXT,
    "deliverables" TEXT,
    "caseStudy" TEXT,
    "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiresAuth" BOOLEAN NOT NULL DEFAULT false,
    "requiresLoginToViewTrailer" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "showOnHome" BOOLEAN NOT NULL DEFAULT false,
    "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "introStart" INTEGER,
    "introEnd" INTEGER,
    "creditsStart" INTEGER,
    "contentRating" TEXT,
    "contentDescriptors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parentId" TEXT,
    "episodeNumber" INTEGER,
    "seasonNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watch_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watch_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "sessions" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_works" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNewReleases" BOOLEAN NOT NULL DEFAULT true,
    "emailAccountAlerts" BOOLEAN NOT NULL DEFAULT true,
    "autoplay" BOOLEAN NOT NULL DEFAULT true,
    "defaultQuality" TEXT NOT NULL DEFAULT 'auto',
    "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "newReleaseNotifications" BOOLEAN NOT NULL DEFAULT true,
    "newEpisodeNotifications" BOOLEAN NOT NULL DEFAULT true,
    "announcementNotifications" BOOLEAN NOT NULL DEFAULT true,
    "studioUpdates" BOOLEAN NOT NULL DEFAULT true,
    "autoplayNextEpisode" BOOLEAN NOT NULL DEFAULT true,
    "resumePlayback" BOOLEAN NOT NULL DEFAULT true,
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "notifyMeFollowupEmails" BOOLEAN NOT NULL DEFAULT true,
    "savedWorkNotifications" BOOLEAN NOT NULL DEFAULT true,
    "watchReminderNotifications" BOOLEAN NOT NULL DEFAULT false,
    "securityEmails" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "workId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_sessions" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "landingPage" TEXT,
    "referrer" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "deviceType" "DeviceType" NOT NULL DEFAULT 'UNKNOWN',
    "browser" TEXT,
    "os" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "type" "AnalyticsEventType" NOT NULL,
    "path" TEXT,
    "workId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "provider" "EmailProvider" NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_suppressions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "targetId" TEXT,
    "targetEmail" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "emailSendingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "primaryEmailProvider" TEXT NOT NULL DEFAULT 'graph',
    "primaryBulkProvider" TEXT NOT NULL DEFAULT 'acs',
    "bulkEmailSendingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "testBulkEmailRecipient" TEXT,
    "testEmailRecipient" TEXT,
    "fromDisplayName" TEXT NOT NULL DEFAULT 'AIM Studio',
    "replyToEmail" TEXT,
    "adminAlertEmail" TEXT,
    "welcomeEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "passwordResetEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notificationEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultRequireLoginToWatch" BOOLEAN NOT NULL DEFAULT false,
    "defaultRequireLoginToViewTrailer" BOOLEAN NOT NULL DEFAULT false,
    "allowPublicProjectDetails" BOOLEAN NOT NULL DEFAULT true,
    "showLockedContentInCatalog" BOOLEAN NOT NULL DEFAULT true,
    "showCasting" BOOLEAN NOT NULL DEFAULT false,
    "showScripts" BOOLEAN NOT NULL DEFAULT false,
    "showTraining" BOOLEAN NOT NULL DEFAULT false,
    "showSponsors" BOOLEAN NOT NULL DEFAULT false,
    "showDonations" BOOLEAN NOT NULL DEFAULT false,
    "showCommunityComments" BOOLEAN NOT NULL DEFAULT false,
    "showWatchParty" BOOLEAN NOT NULL DEFAULT false,
    "showNotifications" BOOLEAN NOT NULL DEFAULT true,
    "inAppNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "newReleaseNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "newEpisodeNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "announcementNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultAutoplayNextEpisode" BOOLEAN NOT NULL DEFAULT true,
    "defaultResumePlayback" BOOLEAN NOT NULL DEFAULT true,
    "defaultVideoPreload" TEXT NOT NULL DEFAULT 'none',
    "allowGoogleSignIn" BOOLEAN NOT NULL DEFAULT true,
    "allowCredentialsSignIn" BOOLEAN NOT NULL DEFAULT true,
    "allowNewRegistrations" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginWindowMinutes" INTEGER NOT NULL DEFAULT 15,
    "failedLoginMaxAttempts" INTEGER NOT NULL DEFAULT 5,
    "loginCooldownMinutes" INTEGER NOT NULL DEFAULT 15,
    "notifyUserOnNewDevice" BOOLEAN NOT NULL DEFAULT true,
    "notifyUserOnNewLocation" BOOLEAN NOT NULL DEFAULT true,
    "notifyAdminOnSuspiciousAdminLogin" BOOLEAN NOT NULL DEFAULT true,
    "allowUserDeviceTrust" BOOLEAN NOT NULL DEFAULT true,
    "requireReauthForSensitiveActions" BOOLEAN NOT NULL DEFAULT true,
    "allowHardPurgeForSuperAdmin" BOOLEAN NOT NULL DEFAULT true,
    "emailLogRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "emailQueueRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "notificationRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "visitorEventRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actorUserId" TEXT,
    "type" "SecurityEventType" NOT NULL,
    "severity" "SecuritySeverity" NOT NULL,
    "email" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "deviceFingerprintHash" TEXT,
    "provider" TEXT,
    "path" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "severity" "SecuritySeverity" NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SecurityAlertStatus" NOT NULL DEFAULT 'OPEN',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "security_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL DEFAULT 'UNKNOWN',
    "browser" TEXT,
    "os" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trustedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "type" "EmailType" NOT NULL,
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_queue" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "provider" "EmailProvider" NOT NULL DEFAULT 'ACS',
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "campaignId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "hrefLabel" TEXT,
    "type" "NotificationType" NOT NULL DEFAULT 'ANNOUNCEMENT',
    "sendInApp" BOOLEAN NOT NULL DEFAULT true,
    "sendEmail" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "audienceType" TEXT NOT NULL DEFAULT 'all',
    "targetUserIds" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "emailQueuedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify_me_ctas" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "type" "CtaType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "headline" TEXT NOT NULL DEFAULT 'Stay in the Loop',
    "body" TEXT,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Notify Me',
    "triggerSecondsFromEnd" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notify_me_ctas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify_me_signups" (
    "id" TEXT NOT NULL,
    "ctaId" TEXT,
    "workId" TEXT NOT NULL,
    "workTitle" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notify_me_signups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT,
    "parentId" TEXT,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_likes" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_reports" (
    "id" TEXT NOT NULL,
    "reason" "CommentReportReason" NOT NULL,
    "details" VARCHAR(500),
    "status" "CommentReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "comment_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_media" (
    "id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "deviceTarget" "DeviceTarget" NOT NULL DEFAULT 'BOTH',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "videoUrl" TEXT NOT NULL DEFAULT '',
    "posterUrl" TEXT NOT NULL DEFAULT '',
    "altText" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "works_slug_key" ON "works"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "watch_progress_userId_workId_key" ON "watch_progress"("userId", "workId");

-- CreateIndex
CREATE INDEX "work_likes_workId_idx" ON "work_likes"("workId");

-- CreateIndex
CREATE UNIQUE INDEX "work_likes_userId_workId_key" ON "work_likes"("userId", "workId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "saved_works_userId_workId_key" ON "saved_works"("userId", "workId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "visitor_sessions_visitorId_idx" ON "visitor_sessions"("visitorId");

-- CreateIndex
CREATE INDEX "visitor_sessions_userId_idx" ON "visitor_sessions"("userId");

-- CreateIndex
CREATE INDEX "visitor_sessions_createdAt_idx" ON "visitor_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_visitorId_idx" ON "analytics_events"("visitorId");

-- CreateIndex
CREATE INDEX "analytics_events_userId_idx" ON "analytics_events"("userId");

-- CreateIndex
CREATE INDEX "analytics_events_type_idx" ON "analytics_events"("type");

-- CreateIndex
CREATE INDEX "analytics_events_workId_idx" ON "analytics_events"("workId");

-- CreateIndex
CREATE INDEX "analytics_events_createdAt_idx" ON "analytics_events"("createdAt");

-- CreateIndex
CREATE INDEX "email_logs_to_idx" ON "email_logs"("to");

-- CreateIndex
CREATE INDEX "email_logs_type_idx" ON "email_logs"("type");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_createdAt_idx" ON "email_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_suppressions_email_key" ON "email_suppressions"("email");

-- CreateIndex
CREATE INDEX "email_suppressions_email_idx" ON "email_suppressions"("email");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actorId_idx" ON "admin_audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_targetId_idx" ON "admin_audit_logs"("targetId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

-- CreateIndex
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "login_attempts_email_idx" ON "login_attempts"("email");

-- CreateIndex
CREATE INDEX "login_attempts_ipHash_idx" ON "login_attempts"("ipHash");

-- CreateIndex
CREATE INDEX "login_attempts_userId_idx" ON "login_attempts"("userId");

-- CreateIndex
CREATE INDEX "login_attempts_createdAt_idx" ON "login_attempts"("createdAt");

-- CreateIndex
CREATE INDEX "security_events_userId_idx" ON "security_events"("userId");

-- CreateIndex
CREATE INDEX "security_events_type_idx" ON "security_events"("type");

-- CreateIndex
CREATE INDEX "security_events_severity_idx" ON "security_events"("severity");

-- CreateIndex
CREATE INDEX "security_events_email_idx" ON "security_events"("email");

-- CreateIndex
CREATE INDEX "security_events_createdAt_idx" ON "security_events"("createdAt");

-- CreateIndex
CREATE INDEX "security_alerts_userId_idx" ON "security_alerts"("userId");

-- CreateIndex
CREATE INDEX "security_alerts_status_idx" ON "security_alerts"("status");

-- CreateIndex
CREATE INDEX "security_alerts_severity_idx" ON "security_alerts"("severity");

-- CreateIndex
CREATE INDEX "security_alerts_createdAt_idx" ON "security_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "user_devices_userId_idx" ON "user_devices"("userId");

-- CreateIndex
CREATE INDEX "user_devices_fingerprintHash_idx" ON "user_devices"("fingerprintHash");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_userId_fingerprintHash_key" ON "user_devices"("userId", "fingerprintHash");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_name_key" ON "email_templates"("name");

-- CreateIndex
CREATE INDEX "email_queue_status_idx" ON "email_queue"("status");

-- CreateIndex
CREATE INDEX "email_queue_scheduledAt_idx" ON "email_queue"("scheduledAt");

-- CreateIndex
CREATE INDEX "email_queue_campaignId_idx" ON "email_queue"("campaignId");

-- CreateIndex
CREATE INDEX "email_queue_to_idx" ON "email_queue"("to");

-- CreateIndex
CREATE INDEX "announcements_publishedAt_idx" ON "announcements"("publishedAt");

-- CreateIndex
CREATE INDEX "announcements_scheduledAt_idx" ON "announcements"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "notify_me_ctas_workId_key" ON "notify_me_ctas"("workId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "notify_me_signups_ctaId_idx" ON "notify_me_signups"("ctaId");

-- CreateIndex
CREATE INDEX "notify_me_signups_workId_idx" ON "notify_me_signups"("workId");

-- CreateIndex
CREATE INDEX "notify_me_signups_email_idx" ON "notify_me_signups"("email");

-- CreateIndex
CREATE INDEX "notify_me_signups_createdAt_idx" ON "notify_me_signups"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notify_me_signups_ctaId_email_key" ON "notify_me_signups"("ctaId", "email");

-- CreateIndex
CREATE INDEX "comments_workId_status_createdAt_idx" ON "comments"("workId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- CreateIndex
CREATE INDEX "comments_userId_idx" ON "comments"("userId");

-- CreateIndex
CREATE INDEX "comment_likes_userId_idx" ON "comment_likes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_likes_commentId_userId_key" ON "comment_likes"("commentId", "userId");

-- CreateIndex
CREATE INDEX "comment_reports_status_idx" ON "comment_reports"("status");

-- CreateIndex
CREATE INDEX "comment_reports_commentId_idx" ON "comment_reports"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_reports_commentId_userId_key" ON "comment_reports"("commentId", "userId");

-- CreateIndex
CREATE INDEX "page_media_page_idx" ON "page_media"("page");

-- CreateIndex
CREATE INDEX "page_media_active_idx" ON "page_media"("active");

-- CreateIndex
CREATE INDEX "page_media_page_deviceTarget_idx" ON "page_media"("page", "deviceTarget");

-- CreateIndex
CREATE INDEX "page_media_page_active_sortOrder_idx" ON "page_media"("page", "active", "sortOrder");

-- AddForeignKey
ALTER TABLE "works" ADD CONSTRAINT "works_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "works"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_likes" ADD CONSTRAINT "work_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_likes" ADD CONSTRAINT "work_likes_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_works" ADD CONSTRAINT "saved_works_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_works" ADD CONSTRAINT "saved_works_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "visitor_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notify_me_ctas" ADD CONSTRAINT "notify_me_ctas_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notify_me_signups" ADD CONSTRAINT "notify_me_signups_ctaId_fkey" FOREIGN KEY ("ctaId") REFERENCES "notify_me_ctas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

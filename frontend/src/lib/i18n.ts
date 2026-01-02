import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: true,
    lng: 'vi', // Default language forced to Vietnamese
    fallbackLng: 'vi',
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    resources: {
      en: {
        translation: {
          common: {
            save: "Save",
            cancel: "Cancel",
            loading: "Loading...",
            uploading: "Uploading...",
            error: "Error",
            success: "Success",
            settings: "Settings",
            theme: "Theme",
            logout: "Logout",
            search: "Search",
            add_friend: "Add Friend",
            create_group: "Create Group",
            groups: "GROUPS",
            friends: "FRIENDS",
            no_groups: "No groups yet",
            no_friends: "No friends yet",
            online: "Online",
            offline: "Offline",
            members: "members",
            type_message: "Type a message...",
            upload_failed: "Upload failed",
            remove: "Remove",
            delete: "Delete",
            close: "Close",
            is_typing: "is typing..."
          },
          profile: {
            title: "Profile Settings",
            display_name: "Display Name",
            phone: "Phone Number",
            dob: "Date of Birth",
            bio: "Bio",
            bio_placeholder: "A few words about yourself...",
            change_avatar_hint: "Click to change avatar",
            save_changes: "Save Changes",
            saving: "Saving...",
            update_success: "Profile updated successfully!",
            update_error: "Failed to update profile",
            joined: "Joined",
            email: "Email"
          },
          sidebar_right: {
            title: "Conversation Info",
            members: "Members",
            media: "Media & Files",
            no_media: "No media shared yet",
            info: "Info",
            select_chat: "Select a conversation to view details",
            personal_info: "Personal Info",
            user_id: "User ID"
          },
          dialog: {
            create_group_title: "Create New Group Chat",
            group_name: "Group Name",
            group_name_placeholder: "Enter group name...",
            select_members: "Select Members",
            no_friends_found: "No friends found",
            add_friend_title: "Add a Friend",
            search_placeholder: "Search by username or email...",
            no_users_found: "No users found.",
            search_prompt: "Search for users to add them as friends.",
            friend_requests_title: "Friend Requests",
            no_requests: "No friend requests",
            loading: "Loading..."
          },
          toast: {
             req_sent_success: "Friend request sent!",
             req_sent_fail: "Failed to send request. Maybe already sent?",
             req_accepted_success: "Friend request accepted",
             req_accepted_fail: "Failed to accept request",
             group_created_success: "Group created successfully",
             group_create_fail: "Failed to create group",
             group_validation: "Please enter group name and select at least 2 friends"
          }
        }
      },
      vi: {
        translation: {
          common: {
            save: "Lưu",
            cancel: "Hủy",
            loading: "Đang tải...",
            uploading: "Đang tải lên...",
            error: "Lỗi",
            success: "Thành công",
            settings: "Cài đặt",
            theme: "Giao diện",
            logout: "Đăng xuất",
            search: "Tìm kiếm",
            add_friend: "Thêm bạn",
            create_group: "Tạo nhóm",
            groups: "NHÓM CHAT",
            friends: "BẠN BÈ",
            no_groups: "Chưa có nhóm nào",
            no_friends: "Chưa có bạn bè",
            online: "Đang hoạt động",
            offline: "Ngoại tuyến",
            members: "thành viên",
            type_message: "Nhập tin nhắn...",
            upload_failed: "Tải lên thất bại",
            remove: "Xóa",
            delete: "Xóa",
            close: "Đóng",
            is_typing: "đang soạn tin..."
          },
          profile: {
            title: "Cài đặt Profile",
            display_name: "Tên hiển thị",
            phone: "Số điện thoại",
            dob: "Ngày sinh",
            bio: "Giới thiệu",
            bio_placeholder: "Vài dòng về bản thân...",
            change_avatar_hint: "Nhấn để thay đổi ảnh đại diện",
            save_changes: "Lưu thay đổi",
            saving: "Đang lưu...",
            update_success: "Cập nhật thành công!",
            update_error: "Lỗi khi cập nhật profile",
            joined: "Tham gia từ",
            email: "Email"
          },
          sidebar_right: {
            title: "Thông tin hội thoại",
            members: "Thành viên",
            media: "Ảnh & File",
            no_media: "Chưa có ảnh/file nào được chia sẻ",
            info: "Thông tin",
            select_chat: "Chọn một cuộc trò chuyện để xem chi tiết",
            personal_info: "Thông tin cá nhân",
            user_id: "User ID"
          },
          dialog: {
            create_group_title: "Tạo nhóm chat mới",
            group_name: "Tên nhóm",
            group_name_placeholder: "Nhập tên nhóm...",
            select_members: "Chọn thành viên",
            no_friends_found: "Không có bạn bè nào",
            add_friend_title: "Thêm bạn bè",
            search_placeholder: "Tìm theo tên hoặc email...",
            no_users_found: "Không tìm thấy người dùng.",
            search_prompt: "Tìm kiếm người dùng để kết bạn.",
            friend_requests_title: "Lời mời kết bạn",
            no_requests: "Không có lời mời kết bạn nào",
            loading: "Đang tải..."
          },
          toast: {
             req_sent_success: "Đã gửi lời mời kết bạn!",
             req_sent_fail: "Gửi thất bại. Có thể đã gửi rồi?",
             req_accepted_success: "Đã chấp nhận lời mời",
             req_accepted_fail: "Chấp nhận thất bại",
             group_created_success: "Tạo nhóm thành công",
             group_create_fail: "Không thể tạo nhóm",
             group_validation: "Vui lòng nhập tên nhóm và chọn ít nhất 2 bạn bè"
          }
        }
      }
    }
  });

export default i18n;

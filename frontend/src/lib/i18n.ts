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
            remove: "Remove"
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
            remove: "Xóa"
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
          }
        }
      }
    }
  });

export default i18n;

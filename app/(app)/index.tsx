// app/(app)/index.tsx
import { ActivityIndicator, View } from 'react-native';
import AdminDashboard from '../../components/dashboard/AdminDashboard';
import ManagerDashboard from '../../components/dashboard/ManagerDashboard';
import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useTheme } from '../../src/context/ThemeContext';

export default function DashboardScreen() {
    const { user, loading, reload } = useCurrentUser();
    const { theme } = useTheme();

    if (loading || !user) {
        return (
            <ScreenWrapper>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.primaryDeep} />
                </View>
            </ScreenWrapper>
        );
    }

    if (user.is_superuser || user.is_staff) {
        return <AdminDashboard user={user} onRefresh={reload} />;
    }

    return <ManagerDashboard user={user} onRefresh={reload} />;
}
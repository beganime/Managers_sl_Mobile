// app/login.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Easing,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Импорты внутренних сервисов проекта
import apiClient from '../src/api/apiClient';
import { saveToken } from '../src/utils/storage';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Анимация фона (плавное движение сфер)
    const moveAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(moveAnim, {
                toValue: 1,
                duration: 20000,
                easing: Easing.linear,
                useNativeDriver: false,
            })
        ).start();
    }, []);

    // Интерполяция для движения сфер
    const orb1X = moveAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 100] });
    const orb2Y = moveAnim.interpolate({ inputRange: [0, 1], outputRange: [50, -50] });

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Внимание", "Пожалуйста, заполните все поля доступа.");
            return;
        }

        setLoading(true);
        try {
            // Исправленный путь: теперь запрос идет на /api/token/ 
            // (предполагается, что apiClient добавляет /api/ автоматически)
            const response = await apiClient.post('token/', { 
                email: email.trim(), 
                password: password 
            });
            
            // Сохранение токенов через ваш сервис storage
            await saveToken('access_token', response.data.access);
            await saveToken('refresh_token', response.data.refresh);
            
            if (rememberMe) {
                await saveToken('remember_me', 'true');
            }

            // Мгновенный редирект в основной стек (app)
            router.replace('/(app)');
            
        } catch (error: any) {
            console.error("Auth Failed:", error.response?.data || error.message);
            const errorDetail = error.response?.data?.detail || "Ошибка входа. Проверьте почту и пароль.";
            Alert.alert("Ошибка авторизации", errorDetail);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Анимированный премиальный фон */}
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={['#F8FAFC', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
                
                {/* Синяя сфера */}
                <Animated.View style={[
                    styles.orb, 
                    { 
                        top: '5%', 
                        left: orb1X, 
                        backgroundColor: '#0D416D', 
                        opacity: 0.08 
                    }
                ]} />
                
                {/* Красная сфера */}
                <Animated.View style={[
                    styles.orb, 
                    { 
                        bottom: '10%', 
                        right: orb1X, 
                        top: orb2Y,
                        backgroundColor: '#B71D17', 
                        opacity: 0.05,
                        width: 500,
                        height: 500
                    }
                ]} />
            </View>

            <View style={styles.content}>
                {/* Максимальный эффект стекла (Glassmorphism) */}
                <BlurView intensity={Platform.OS === 'ios' ? 45 : 90} tint="light" style={styles.glassCard}>
                    <View style={styles.header}>
                        {/* Интеграция SVG логотипа (немного уменьшен для изящности) */}
                        <View style={styles.logoWrapper}>
                            <Svg width="180" height="42" viewBox="0 0 271 65" fill="none">
                                <Path d="M27.6688 47.1472C33.1961 47.1472 37.6768 42.6671 37.6768 37.1408C37.6768 31.6144 33.1961 27.1344 27.6688 27.1344C22.1415 27.1344 17.6608 31.6144 17.6608 37.1408C17.6608 42.6671 22.1415 47.1472 27.6688 47.1472Z" fill="#0D416D"/>
                                <Path d="M40.2732 34.8842C41.0691 34.8842 41.7143 34.239 41.7143 33.4431C41.7143 32.6472 41.0691 32.002 40.2732 32.002C39.4773 32.002 38.8322 32.6472 38.8322 33.4431C38.8322 34.239 39.4773 34.8842 40.2732 34.8842Z" fill="#B71D17"/>
                                <Path d="M41.0048 16.4604H13.3982V19.6324H41.0048V16.4604Z" fill="#B71D17"/>
                                <Path d="M41.0047 16.8337H39.8242V32.4623H41.0047V16.8337Z" fill="#B71D17"/>
                                <Path d="M40.6249 32.565L40.0262 39.719L41.9843 39.7253L40.6249 32.565Z" fill="#B71D17"/>
                                <Path d="M38.8667 39.7596L40.0745 34.5207L41.0059 34.5751L38.8667 39.7596Z" fill="#B71D17"/>
                                <Path d="M37.6758 21.2653H17.3708V30.4273H37.6758V21.2653Z" fill="#B71D17"/>
                                <Path d="M3.64319 12.9707C7.5158 12.254 11.3482 11.3351 15.1248 10.2177C19.3835 8.7225 23.4831 6.80768 27.3629 4.50146L27.3503 7.70021C23.7135 9.74982 19.9025 11.4739 15.962 12.8525C12.8782 13.8836 9.72321 14.6879 6.52219 15.2592L3.64319 12.9707Z" fill="#0D416D"/>
                                <Path d="M3.64345 12.9708C3.64345 12.9708 3.53143 35.2249 3.70515 36.5611C3.82716 39.0687 4.54732 41.5107 5.80551 43.6834C7.06369 45.8561 8.82341 47.6963 10.9378 49.0505C17.8041 53.4954 27.4731 59.6303 27.4731 59.6303L27.4187 56.2819C27.4187 56.2819 13.7739 47.9413 11.8002 46.2148C9.8264 44.4883 6.66377 41.0207 6.38435 36.3058C6.10492 31.5908 6.52245 15.2613 6.52245 15.2613L3.64345 12.9708Z" fill="#0D416D"/>
                                <Path d="M51.0672 12.9707C47.1946 12.254 43.3622 11.3351 39.5857 10.2177C35.3325 8.72187 31.2386 6.80704 27.3642 4.50146C27.3391 7.68137 27.3516 7.70021 27.3516 7.70021C30.9918 9.74906 34.8055 11.4731 38.7484 12.8525C41.8322 13.8836 44.9872 14.6879 48.1882 15.2592L51.0672 12.9707Z" fill="#0D416D"/>
                                <Path d="M51.0672 12.9708C51.0672 12.9708 51.1792 35.2249 51.0055 36.5611C50.8834 39.0686 50.1632 41.5107 48.905 43.6833C47.6468 45.856 45.8872 47.6962 43.7729 49.0505C36.9065 53.4954 27.472 59.6303 27.472 59.6303L27.4176 56.2819C27.4176 56.2819 40.9368 47.9413 42.9063 46.2148C44.8759 44.4883 48.0438 41.0207 48.3222 36.3058C48.6005 31.5908 48.184 15.2613 48.184 15.2613L51.0672 12.9708Z" fill="#0D416D"/>
                                <Path d="M0.0472412 9.98757C4.18478 9.25954 8.27609 8.28964 12.3001 7.08286C17.6253 5.19818 22.7657 2.82721 27.656 0C27.6811 1.85625 27.656 1.93997 27.656 1.93997C23.5212 4.30599 19.1941 6.31902 14.7207 7.95762C10.4751 9.49525 6.09012 10.6167 1.62752 11.306C0.674127 10.4469 0.0472412 9.98757 0.0472412 9.98757Z" fill="#B71D17"/>
                                <Path d="M0.0465128 9.99173C0.0465128 9.99173 -0.058141 35.4069 0.0465128 36.6929C0.151166 37.9789 0.641967 43.2474 3.81402 47.1681C5.66747 49.6015 7.96322 51.6636 10.5809 53.2464L27.651 64.1286L27.6374 62.1541C27.6374 62.1541 11.6913 52.1404 10.4595 51.3002C7.10115 49.0585 4.44283 45.9157 2.78946 42.2324C0.773827 37.1941 1.64664 29.0618 1.62571 28.3157C1.60478 27.5697 1.62571 11.194 1.62571 11.194L0.0465128 9.99173Z" fill="#B71D17"/>
                                <Path d="M55.2379 9.98757C51.1003 9.25955 47.009 8.28965 42.985 7.08286C37.6695 5.19819 32.5392 2.82717 27.6595 0C27.6344 1.85625 27.6595 1.93997 27.6595 1.93997C31.7816 4.31078 36.0994 6.32404 40.5654 7.95762C44.811 9.49527 49.196 10.6167 53.6586 11.306C54.6099 10.4469 55.2379 9.98757 55.2379 9.98757Z" fill="#B71D17"/>
                                <Path d="M55.2335 9.99173C55.2335 9.99173 55.3382 35.4069 55.2335 36.6929C55.1288 37.9789 54.638 43.2474 51.466 47.1681C49.6126 49.6015 47.3168 51.6636 44.6991 53.2464L27.652 64.1286L27.6384 62.1541C27.6384 62.1541 43.5887 52.1404 44.8204 51.3002C48.1788 49.0586 50.8372 45.9158 52.4906 42.2324C54.5062 37.1941 53.6334 29.0618 53.6543 28.3157C53.6752 27.5697 53.6543 11.194 53.6543 11.194L55.2335 9.99173Z" fill="#B71D17"/>
                                <Path d="M28.7152 30.1332V27.4273H25.5903L24.1418 25.9792V24.351L25.5903 22.9081H26.4066V25.4717H29.7273L31.1264 26.9198V28.6892L29.6833 30.1322L28.7152 30.1332ZM25.3559 30.1332L24.1418 28.6903V27.9662H26.5489V28.8263H28.3343V30.1332H25.3559ZM28.7152 24.9349V24.2108H26.7875V22.9102H29.6781L30.9339 24.1658V24.9338L28.7152 24.9349Z" fill="#E0DFDD"/>
                                <Path d="M27.6384 34.0755C28.8514 33.0618 30.2001 32.2227 31.6456 31.5827C33.5705 30.841 35.613 30.4511 37.6757 30.4315H17.3698C19.2604 30.5152 21.1254 30.9021 22.8934 31.5774C24.5797 32.1942 26.1756 33.0344 27.6384 34.0755Z" fill="#B71D17"/>
                                <Path d="M87.5288 35.2112V26.8715H77.895L73.4309 22.4081V17.3872L77.895 12.9406H80.4123V20.8477H90.65L94.9634 25.3112V30.7607L90.5161 35.2074L87.5288 35.2112ZM77.1739 35.2112L73.4309 30.7645V28.5322H80.8488V31.1843H86.3533V35.2112H77.1739ZM87.5288 19.1858V16.9534H81.5879V12.9432H90.4994L94.3622 16.8195V19.1858H87.5288Z" fill="#B8201A"/>
                                <Path d="M96.6759 17.7926V12.9431H116.011V17.7926H96.6759ZM102.483 35.2111V18.9513H110.209V35.2111H102.483Z" fill="#B8201A"/>
                                <Path d="M123.313 35.2111L118.848 30.7644V12.9431H126.283V30.7605H129.019V35.2072L123.313 35.2111ZM130.194 35.2111V30.7605H132.946V12.9431H140.364V30.7605L135.917 35.2072L130.194 35.2111Z" fill="#B8201A"/>
                                <Path d="M143.921 35.2113V12.9393H151.339V35.2113H143.921ZM152.514 35.2113V30.7607H158.019V17.3899H152.509V12.9433H160.984L165.448 17.3899V30.7607L160.984 35.2074L152.514 35.2113Z" fill="#B8201A"/>
                                <Path d="M168.86 35.2113V12.9393H176.278V21.7657H183.378V26.0618H176.278V35.2022L168.86 35.2113ZM182.069 19.3867V17.256H177.453V12.9433H189.05V19.3867H182.069ZM177.453 35.2113V30.7607H181.631V28.5284H189.049V35.2074L177.453 35.2113Z" fill="#B8201A"/>
                                <Path d="M205.986 35.2113L192.492 12.9393H200.329L213.874 35.2113H205.986ZM192.492 35.2113V15.0545L198.953 25.6434V35.2087L192.492 35.2113ZM213.874 33.0974L207.412 22.4584V12.9433H213.874V33.0974Z" fill="#B8201A"/>
                                <Path d="M216.71 17.7926V12.9431H236.045V17.7926H216.71ZM222.517 35.2111V18.9513H230.243V35.2111H222.517Z" fill="#B8201A"/>
                                <Path d="M247.154 12.9431V18.1441L244.201 22.5907H239.718L241.817 18.1441H238.997V12.9431H247.154Z" fill="#B8201A"/>
                                <Path d="M263.552 35.211V26.8713H253.918L249.454 22.4079V17.387L253.918 12.9404H256.435V20.8475H266.673L270.987 25.311V30.7605L266.539 35.2072L263.552 35.211ZM253.197 35.211L249.454 30.7643V28.532H256.872V31.1841H262.376V35.211H253.197ZM263.552 19.1856V16.9532H257.61V12.943H266.521L270.384 16.8193V19.1856H263.552Z" fill="#B8201A"/>
                                <Path d="M76.6162 59.9936V44.1586H81.8954V59.9936H76.6162ZM82.7285 59.9936V56.8304H85.3423V54.8247H90.1296V59.9936H82.7285Z" fill="#0D416D"/>
                                <Path d="M92.1229 59.9936V56.6155H93.7105V47.52H92.1229V44.1549H100.575V47.52H98.9871V56.6155H100.575V59.9936H92.1229Z" fill="#0D416D"/>
                                <Path d="M103.129 59.9936V44.1586H108.408V51.2393H113.277V54.3549H108.406V60.0001L103.129 59.9936ZM112.014 49.4061V47.3179H109.244V44.1549H117.29V49.4061H112.014Z" fill="#0D416D"/>
                                <Path d="M119.578 59.9936V44.1586H124.858V50.4374H129.907V53.4922H124.858V59.9974L119.578 59.9936ZM128.978 48.7379V47.2226H125.696V44.1549H133.944V48.7379H128.978ZM125.696 59.9936V56.8305H128.668V55.2431H133.947V59.9936H125.696Z" fill="#0D416D"/>
                            </Svg>
                        </View>
                        <Text style={styles.subtitle}>Единая экосистема управления ERP</Text>
                    </View>

                    <View style={styles.form}>
                        <Text style={styles.label}>Электронная почта</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="mail-outline" size={18} color="#64748B" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="manager@studentslife.com"
                                placeholderTextColor="#94A3B8"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <Text style={styles.label}>Пароль доступа</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••"
                                placeholderTextColor="#94A3B8"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity 
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeIcon}
                            >
                                <Ionicons 
                                    name={showPassword ? "eye-off" : "eye"} 
                                    size={20} 
                                    color="#64748B" 
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.optionsRow}>
                            <Pressable 
                                style={styles.checkboxContainer}
                                onPress={() => setRememberMe(!rememberMe)}
                            >
                                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                                    {rememberMe && <Ionicons name="checkmark" size={12} color="#FFF" />}
                                </View>
                                <Text style={styles.checkboxLabel}>Запомнить меня</Text>
                            </Pressable>
                        </View>

                        <TouchableOpacity 
                            style={[styles.loginButton, loading && styles.disabledButton]} 
                            onPress={handleLogin}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#0D416D', '#164E80']}
                                start={{x: 0, y: 0}}
                                end={{x: 1, y: 0}}
                                style={styles.gradientButton}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <>
                                        <Text style={styles.loginButtonText}>Войти в систему</Text>
                                        <Ionicons name="arrow-forward" size={18} color="#FFF" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.versionText}>MANAGERS SL ERP • v2.5 PREMIUM</Text>
                </BlurView>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    orb: {
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: 200,
        filter: Platform.OS === 'web' ? 'blur(60px)' : undefined, // Усиленный блюр для Web
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    glassCard: {
        borderRadius: 32,
        padding: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.65)', 
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.9)',
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.05,
                shadowRadius: 20,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoWrapper: {
        marginBottom: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    subtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 4,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    form: {
        width: '100%',
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 8,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 20,
        height: 54,
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#0F172A',
        fontWeight: '600',
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            }
        })
    },
    eyeIcon: {
        padding: 6,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#94A3B8',
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
    },
    checkboxChecked: {
        backgroundColor: '#0D416D',
        borderColor: '#0D416D',
    },
    checkboxLabel: {
        fontSize: 13,
        color: '#334155',
        fontWeight: '600',
    },
    loginButton: {
        borderRadius: 16,
        height: 56,
        overflow: 'hidden',
        shadowColor: '#0D416D',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    gradientButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        marginRight: 8,
        letterSpacing: 0.5,
    },
    disabledButton: {
        opacity: 0.7,
    },
    versionText: {
        textAlign: 'center',
        marginTop: 24,
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    }
});
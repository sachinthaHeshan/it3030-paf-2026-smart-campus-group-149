package com.sliit.smartcampus.auth;

import com.sliit.smartcampus.auth.dto.AuthResponse;
import com.sliit.smartcampus.auth.dto.LoginRequest;
import com.sliit.smartcampus.auth.dto.RegisterRequest;
import com.sliit.smartcampus.auth.dto.UpdateProfileRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final GoogleTokenVerifier googleTokenVerifier;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(GoogleTokenVerifier googleTokenVerifier,
                       UserRepository userRepository,
                       JwtService jwtService,
                       PasswordEncoder passwordEncoder) {
        this.googleTokenVerifier = googleTokenVerifier;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    public AuthResponse register(RegisterRequest req) {
        String email = req.email() == null ? "" : req.email().trim().toLowerCase();
        String name = req.name() == null ? "" : req.name().trim();
        String password = req.password() == null ? "" : req.password();

        if (email.isEmpty() || name.isEmpty() || password.isEmpty()) {
            throw new IllegalArgumentException("Email, name and password are required");
        }
        if (!isStrongEnough(password)) {
            throw new IllegalArgumentException(
                    "Password must be at least 8 characters and contain a letter and a number");
        }
        if (userRepository.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("Email already registered");
        }

        String hash = passwordEncoder.encode(password);
        User user = userRepository.save(email, name, null, "EMAIL", null, hash);

        String token = jwtService.generateToken(user);
        return new AuthResponse(token, toDto(user));
    }

    public AuthResponse login(LoginRequest req) {
        String email = req.email() == null ? "" : req.email().trim().toLowerCase();
        String password = req.password() == null ? "" : req.password();

        if (email.isEmpty() || password.isEmpty()) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        if (!"EMAIL".equals(user.provider()) || user.passwordHash() == null) {
            throw new IllegalArgumentException("This account uses Google sign-in");
        }
        if (!passwordEncoder.matches(password, user.passwordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }
        if (!user.isActive()) {
            throw new IllegalStateException("Account is deactivated");
        }

        String token = jwtService.generateToken(user);
        return new AuthResponse(token, toDto(user));
    }

    private boolean isStrongEnough(String password) {
        return password.length() >= 8
                && password.matches(".*[A-Za-z].*")
                && password.matches(".*\\d.*");
    }

    public AuthResponse authenticateWithGoogle(String googleCredential) {
        GoogleTokenVerifier.GoogleUserInfo googleUser = googleTokenVerifier.verify(googleCredential);

        User user = userRepository.findByEmail(googleUser.email())
                .orElseGet(() -> userRepository.save(
                        googleUser.email(),
                        googleUser.name(),
                        googleUser.pictureUrl(),
                        "GOOGLE",
                        googleUser.googleId()));

        if (!user.isActive()) {
            throw new IllegalStateException("Account is deactivated");
        }

        String token = jwtService.generateToken(user);
        return new AuthResponse(token, toDto(user));
    }

    public AuthResponse.UserDto getCurrentUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return toDto(user);
    }

    public AuthResponse.UserDto updateProfile(Long userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String name = request.name();
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Name is required");
        }

        String profilePicture = request.profilePicture() != null
                ? request.profilePicture() : user.profilePicture();

        userRepository.updateProfile(userId, name.trim(), profilePicture);

        User updated = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("Failed to retrieve updated user"));
        return toDto(updated);
    }

    private AuthResponse.UserDto toDto(User user) {
        return new AuthResponse.UserDto(
                user.id(), user.email(), user.name(), user.profilePicture(), user.role());
    }
}

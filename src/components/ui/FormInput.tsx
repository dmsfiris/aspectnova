// src/components/ui/FormInput.tsx
import { useState } from "react";
import {
  TextInput,
  View,
  Text,
  Platform,
  StyleSheet,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle
} from "react-native";

import { colors, inputTokens, spacing } from "@/config/constants";

type Props = {
  label: string;
  helpText?: string;
  isError?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
} & TextInputProps;

export default function FormInput({
  label,
  helpText,
  isError,
  style,
  containerStyle,
  labelStyle,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);

  const borderColor = isError
    ? colors.danger
    : focused
      ? inputTokens.focusBorder
      : inputTokens.border;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>

      <TextInput
        {...rest}
        placeholderTextColor={inputTokens.placeholder}
        onFocus={e => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={e => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            borderColor,
            shadowColor: focused ? inputTokens.focusBorder : "transparent",
            shadowOpacity: focused ? 0.2 : 0,
            shadowRadius: focused ? 6 : 0,
            elevation: focused ? 1 : 0
          },
          style
        ]}
        accessibilityHint={helpText}
      />

      {helpText ? (
        <Text style={[styles.help, isError && styles.helpError]}>{helpText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: {
    fontWeight: "700",
    color: colors.text
  },
  input: {
    height: inputTokens.height,
    borderWidth: 1,
    borderRadius: inputTokens.radius,
    paddingVertical: Platform.OS === "web" ? 10 : 12,
    paddingHorizontal: inputTokens.paddingH,
    backgroundColor: inputTokens.bg,
    color: inputTokens.fg
  },
  help: {
    color: colors.mutedText,
    fontSize: 12
  },
  helpError: {
    color: colors.danger
  }
});

import { View, Text, Button as TaroButton, Textarea } from '@tarojs/components'
import { ReactNode } from 'react'
import './primitives.scss'

type UiButtonProps = {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'quiet'
  disabled?: boolean
  loading?: boolean
  className?: string
  onClick?: () => void
}

export function UiButton({
  children,
  variant = 'primary',
  disabled,
  loading,
  className = '',
  onClick,
}: UiButtonProps) {
  return (
    <TaroButton
      className={`ui-btn ui-btn--${variant}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      loading={loading}
      onClick={onClick}
    >
      {children}
    </TaroButton>
  )
}

type CardProps = { children: ReactNode; className?: string }
export function Card({ children, className = '' }: CardProps) {
  return <View className={`ui-card${className ? ` ${className}` : ''}`}>{children}</View>
}

type TagProps = { children: ReactNode; active?: boolean; onClick?: () => void }
export function Tag({ children, active, onClick }: TagProps) {
  return (
    <Text className={`ui-tag${active ? ' ui-tag--active' : ''}`} onClick={onClick}>
      {children}
    </Text>
  )
}

type InputProps = {
  value: string
  placeholder?: string
  disabled?: boolean
  multiline?: boolean
  maxlength?: number
  onInput: (value: string) => void
}
export function Input({ value, placeholder, disabled, multiline, maxlength, onInput }: InputProps) {
  if (multiline) {
    return (
      <Textarea
        className='ui-input ui-input--area'
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        maxlength={maxlength}
        onInput={(e) => onInput(e.detail.value)}
      />
    )
  }
  return (
    <View className='ui-input-wrap'>
      <Text className='ui-input'>{value || placeholder}</Text>
    </View>
  )
}

type ModalProps = { open: boolean; title: string; children: ReactNode; onClose: () => void }
export function Modal({ open, title, children, onClose }: ModalProps) {
  if (!open) return null
  return (
    <View className='ui-modal-mask' onClick={onClose}>
      <View className='ui-modal' onClick={(e) => e.stopPropagation()}>
        <Text className='ui-modal-title'>{title}</Text>
        {children}
      </View>
    </View>
  )
}

export function Loading({ label = '加载中…' }: { label?: string }) {
  return (
    <View className='ui-loading'>
      <View className='ui-loading-dots'>
        <View className='ui-loading-dot' />
        <View className='ui-loading-dot' />
        <View className='ui-loading-dot' />
      </View>
      <Text className='ui-loading-label'>{label}</Text>
    </View>
  )
}

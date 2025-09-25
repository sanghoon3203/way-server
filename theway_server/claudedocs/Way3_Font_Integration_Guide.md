# Way3 앱 ChosunCentennial 폰트 적용 가이드

## 1. 🎨 폰트 통합 개요

ChosunCentennial_otf 폰트를 Way3 앱 전반에 일관되게 적용하여 한국적 감성과 게임의 정체성을 강화합니다.

## 2. 📱 iOS 프로젝트 폰트 설정

### 2.1 폰트 파일 추가
```swift
// 프로젝트에 폰트 파일 추가 후 Info.plist 설정
// Info.plist에 다음 항목 추가:
<key>UIAppFonts</key>
<array>
    <string>ChosunCentennial.otf</string>
</array>
```

### 2.2 폰트 확장 클래스
```swift
// FontManager.swift - 폰트 관리 유틸리티
import UIKit

enum ChosunFont {
    case light(CGFloat)
    case regular(CGFloat)
    case medium(CGFloat)
    case bold(CGFloat)
    case extraBold(CGFloat)
    
    var font: UIFont {
        switch self {
        case .light(let size):
            return UIFont(name: "ChosunCentennial-Light", size: size) ?? UIFont.systemFont(ofSize: size, weight: .light)
        case .regular(let size):
            return UIFont(name: "ChosunCentennial-Regular", size: size) ?? UIFont.systemFont(ofSize: size, weight: .regular)
        case .medium(let size):
            return UIFont(name: "ChosunCentennial-Medium", size: size) ?? UIFont.systemFont(ofSize: size, weight: .medium)
        case .bold(let size):
            return UIFont(name: "ChosunCentennial-Bold", size: size) ?? UIFont.systemFont(ofSize: size, weight: .bold)
        case .extraBold(let size):
            return UIFont(name: "ChosunCentennial-ExtraBold", size: size) ?? UIFont.systemFont(ofSize: size, weight: .heavy)
        }
    }
}

extension UIFont {
    static func chosun(_ type: ChosunFont) -> UIFont {
        return type.font
    }
    
    // 자주 사용되는 폰트 스타일 단축 메서드
    static func chosunTitle() -> UIFont { return .chosun(.bold(24)) }
    static func chosunHeadline() -> UIFont { return .chosun(.medium(20)) }
    static func chosunBody() -> UIFont { return .chosun(.regular(16)) }
    static func chosunCaption() -> UIFont { return .chosun(.light(14)) }
    static func chosunButton() -> UIFont { return .chosun(.medium(18)) }
}
```

### 2.3 글로벌 폰트 테마 설정
```swift
// AppDelegate.swift - 앱 전체 폰트 설정
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // 전역 폰트 스타일 설정
        setupGlobalFontTheme()
        
        return true
    }
    
    private func setupGlobalFontTheme() {
        // Navigation Bar
        UINavigationBar.appearance().titleTextAttributes = [
            NSAttributedString.Key.font: UIFont.chosunHeadline(),
            NSAttributedString.Key.foregroundColor: UIColor.label
        ]
        
        UINavigationBar.appearance().largeTitleTextAttributes = [
            NSAttributedString.Key.font: UIFont.chosunTitle(),
            NSAttributedString.Key.foregroundColor: UIColor.label
        ]
        
        // Tab Bar
        UITabBarItem.appearance().setTitleTextAttributes([
            NSAttributedString.Key.font: UIFont.chosun(.medium(12))
        ], for: .normal)
        
        // Button
        UIButton.appearance().titleLabel?.font = UIFont.chosunButton()
        
        // Label (기본)
        UILabel.appearance().font = UIFont.chosunBody()
        
        // Text Field
        UITextField.appearance().font = UIFont.chosunBody()
        
        // Text View
        UITextView.appearance().font = UIFont.chosunBody()
    }
}
```

## 3. 🎯 화면별 폰트 적용 가이드

### 3.1 메인 맵 화면 (MapViewController)
```swift
class MapViewController: UIViewController {
    @IBOutlet weak var statusMoneyLabel: UILabel!
    @IBOutlet weak var statusEnergyLabel: UILabel!
    @IBOutlet weak var playerLevelLabel: UILabel!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupFonts()
    }
    
    private func setupFonts() {
        // 상태 바 폰트 설정
        statusMoneyLabel.font = .chosun(.medium(16))
        statusEnergyLabel.font = .chosun(.medium(16))
        playerLevelLabel.font = .chosun(.bold(18))
        
        // 동적 크기 대응 (Accessibility)
        statusMoneyLabel.adjustsFontForContentSizeCategory = true
        statusEnergyLabel.adjustsFontForContentSizeCategory = true
        playerLevelLabel.adjustsFontForContentSizeCategory = true
    }
}
```

### 3.2 상인 정보 팝업 (MerchantDetailViewController)
```swift
class MerchantDetailViewController: UIViewController {
    @IBOutlet weak var merchantNameLabel: UILabel!
    @IBOutlet weak var merchantDescriptionLabel: UILabel!
    @IBOutlet weak var distanceLabel: UILabel!
    @IBOutlet weak var tradeButton: UIButton!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupFonts()
    }
    
    private func setupFonts() {
        // 상인명 - 강조 표시
        merchantNameLabel.font = .chosun(.bold(24))
        merchantNameLabel.textColor = UIColor(named: "PrimaryBlue")
        
        // 설명 텍스트
        merchantDescriptionLabel.font = .chosun(.regular(16))
        merchantDescriptionLabel.textColor = .secondaryLabel
        
        // 거리 정보
        distanceLabel.font = .chosun(.medium(14))
        distanceLabel.textColor = .tertiaryLabel
        
        // 거래 버튼
        tradeButton.titleLabel?.font = .chosun(.bold(18))
        
        // 여러 줄 텍스트 설정
        merchantDescriptionLabel.numberOfLines = 0
        merchantDescriptionLabel.lineBreakMode = .byWordWrapping
    }
}
```

### 3.3 거래 인터페이스 (TradeViewController)
```swift
class TradeViewController: UIViewController {
    @IBOutlet weak var tradeHeaderLabel: UILabel!
    @IBOutlet weak var expectedProfitLabel: UILabel!
    @IBOutlet weak var confirmButton: UIButton!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupTradeInterfaceFonts()
    }
    
    private func setupTradeInterfaceFonts() {
        // 거래 헤더
        tradeHeaderLabel.font = .chosun(.bold(22))
        tradeHeaderLabel.textColor = UIColor(named: "PrimaryGold")
        
        // 예상 수익 라벨
        expectedProfitLabel.font = .chosun(.medium(18))
        
        // 확인 버튼
        confirmButton.titleLabel?.font = .chosun(.bold(20))
        confirmButton.layer.cornerRadius = 12
    }
}

// 거래 아이템 셀
class TradeItemCell: UITableViewCell {
    @IBOutlet weak var itemNameLabel: UILabel!
    @IBOutlet weak var priceLabel: UILabel!
    @IBOutlet weak var quantityLabel: UILabel!
    
    override func awakeFromNib() {
        super.awakeFromNib()
        setupCellFonts()
    }
    
    private func setupCellFonts() {
        itemNameLabel.font = .chosun(.medium(17))
        priceLabel.font = .chosun(.bold(16))
        quantityLabel.font = .chosun(.regular(14))
        
        // 가격 라벨 색상 동적 변경을 위한 설정
        priceLabel.textColor = .label
    }
    
    func configure(with item: TradeItem) {
        itemNameLabel.text = item.name
        priceLabel.text = "\(item.price.formatted())원"
        quantityLabel.text = "재고: \(item.quantity)개"
        
        // 가격에 따른 색상 변경
        priceLabel.textColor = item.isProfitable ? UIColor(named: "PrimaryGreen") : UIColor(named: "PrimaryRed")
    }
}
```

### 3.4 플레이어 프로필 (PlayerProfileViewController)
```swift
class PlayerProfileViewController: UIViewController {
    @IBOutlet weak var nicknameLabel: UILabel!
    @IBOutlet weak var levelLabel: UILabel!
    @IBOutlet weak var statsLabels: [UILabel]!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupProfileFonts()
    }
    
    private func setupProfileFonts() {
        // 닉네임 - 가장 큰 폰트
        nicknameLabel.font = .chosun(.extraBold(28))
        nicknameLabel.textColor = UIColor(named: "PrimaryBlue")
        
        // 레벨 표시
        levelLabel.font = .chosun(.bold(20))
        levelLabel.textColor = UIColor(named: "PrimaryGold")
        
        // 통계 정보들
        statsLabels.forEach { label in
            label.font = .chosun(.medium(16))
            label.textColor = .label
        }
    }
}
```

## 4. 📐 반응형 폰트 시스템

### 4.1 Dynamic Type 지원
```swift
// DynamicFontManager.swift - 접근성 대응
class DynamicFontManager {
    static let shared = DynamicFontManager()
    
    // 기본 폰트 크기 매트릭스
    private let fontSizeMatrix: [UIContentSizeCategory: [String: CGFloat]] = [
        .extraSmall: [
            "title": 20,
            "headline": 16,
            "body": 13,
            "caption": 11
        ],
        .small: [
            "title": 22,
            "headline": 18,
            "body": 14,
            "caption": 12
        ],
        .medium: [
            "title": 24,
            "headline": 20,
            "body": 16,
            "caption": 14
        ],
        .large: [
            "title": 26,
            "headline": 22,
            "body": 18,
            "caption": 16
        ],
        .extraLarge: [
            "title": 28,
            "headline": 24,
            "body": 20,
            "caption": 18
        ],
        .extraExtraLarge: [
            "title": 30,
            "headline": 26,
            "body": 22,
            "caption": 20
        ],
        .extraExtraExtraLarge: [
            "title": 32,
            "headline": 28,
            "body": 24,
            "caption": 22
        ]
    ]
    
    func font(for style: String, weight: ChosunFont) -> UIFont {
        let contentSize = UIApplication.shared.preferredContentSizeCategory
        let sizes = fontSizeMatrix[contentSize] ?? fontSizeMatrix[.medium]!
        let size = sizes[style] ?? 16
        
        switch weight {
        case .light(_):
            return .chosun(.light(size))
        case .regular(_):
            return .chosun(.regular(size))
        case .medium(_):
            return .chosun(.medium(size))
        case .bold(_):
            return .chosun(.bold(size))
        case .extraBold(_):
            return .chosun(.extraBold(size))
        }
    }
}

// 사용 예시
extension UILabel {
    func setDynamicFont(style: String, weight: ChosunFont) {
        font = DynamicFontManager.shared.font(for: style, weight: weight)
        adjustsFontForContentSizeCategory = true
    }
}
```

### 4.2 다국어 지원 대응
```swift
// LocalizedFontManager.swift - 언어별 폰트 최적화
class LocalizedFontManager {
    static let shared = LocalizedFontManager()
    
    func localizedFont(for style: ChosunFont) -> UIFont {
        let currentLanguage = Locale.current.languageCode ?? "ko"
        
        switch currentLanguage {
        case "ko": // 한국어 - ChosunCentennial 사용
            return style.font
        case "en": // 영어 - 시스템 폰트와 혼용
            return UIFont.systemFont(ofSize: style.fontSize, weight: style.systemWeight)
        case "ja": // 일본어 - 일본어 호환 폰트
            return UIFont(name: "HiraginoSans-W3", size: style.fontSize) ?? style.font
        default:
            return style.font
        }
    }
}

extension ChosunFont {
    var fontSize: CGFloat {
        switch self {
        case .light(let size), .regular(let size), .medium(let size), .bold(let size), .extraBold(let size):
            return size
        }
    }
    
    var systemWeight: UIFont.Weight {
        switch self {
        case .light(_): return .light
        case .regular(_): return .regular
        case .medium(_): return .medium
        case .bold(_): return .bold
        case .extraBold(_): return .heavy
        }
    }
}
```

## 5. 🎨 UI 컴포넌트별 스타일 가이드

### 5.1 버튼 스타일
```swift
// CustomButton.swift - 앱 전용 버튼 스타일
@IBDesignable
class ChosunButton: UIButton {
    
    enum ButtonStyle {
        case primary    // 주요 액션
        case secondary  // 보조 액션
        case danger     // 위험한 액션
        case ghost      // 투명 버튼
    }
    
    @IBInspectable var buttonStyle: Int = 0 {
        didSet {
            updateButtonStyle()
        }
    }
    
    override func awakeFromNib() {
        super.awakeFromNib()
        setupButton()
    }
    
    private func setupButton() {
        titleLabel?.font = .chosun(.medium(18))
        layer.cornerRadius = 12
        clipsToBounds = true
        updateButtonStyle()
    }
    
    private func updateButtonStyle() {
        let style = ButtonStyle(rawValue: buttonStyle) ?? .primary
        
        switch style {
        case .primary:
            backgroundColor = UIColor(named: "PrimaryBlue")
            setTitleColor(.white, for: .normal)
            layer.borderWidth = 0
            
        case .secondary:
            backgroundColor = UIColor.clear
            setTitleColor(UIColor(named: "PrimaryBlue"), for: .normal)
            layer.borderWidth = 2
            layer.borderColor = UIColor(named: "PrimaryBlue")?.cgColor
            
        case .danger:
            backgroundColor = UIColor(named: "PrimaryRed")
            setTitleColor(.white, for: .normal)
            layer.borderWidth = 0
            
        case .ghost:
            backgroundColor = UIColor.clear
            setTitleColor(.label, for: .normal)
            layer.borderWidth = 0
        }
    }
    
    // 눌렸을 때 애니메이션
    override var isHighlighted: Bool {
        didSet {
            UIView.animate(withDuration: 0.1) {
                self.alpha = self.isHighlighted ? 0.7 : 1.0
                self.transform = self.isHighlighted ? CGAffineTransform(scaleX: 0.95, y: 0.95) : .identity
            }
        }
    }
}

extension ButtonStyle {
    init?(rawValue: Int) {
        switch rawValue {
        case 0: self = .primary
        case 1: self = .secondary
        case 2: self = .danger
        case 3: self = .ghost
        default: return nil
        }
    }
}
```

### 5.2 카드 뷰 스타일
```swift
// ChosunCardView.swift - 일관된 카드 디자인
@IBDesignable
class ChosunCardView: UIView {
    
    @IBOutlet weak var titleLabel: UILabel!
    @IBOutlet weak var contentLabel: UILabel!
    @IBOutlet weak var valueLabel: UILabel!
    
    override func awakeFromNib() {
        super.awakeFromNib()
        setupCardStyle()
        setupFonts()
    }
    
    private func setupCardStyle() {
        // 카드 디자인
        backgroundColor = UIColor.systemBackground
        layer.cornerRadius = 16
        layer.shadowOpacity = 0.1
        layer.shadowOffset = CGSize(width: 0, height: 4)
        layer.shadowRadius = 8
        layer.shadowColor = UIColor.black.cgColor
        
        // 미세한 테두리
        layer.borderWidth = 0.5
        layer.borderColor = UIColor.separator.cgColor
    }
    
    private func setupFonts() {
        titleLabel?.font = .chosun(.bold(18))
        contentLabel?.font = .chosun(.regular(14))
        valueLabel?.font = .chosun(.medium(16))
        
        titleLabel?.textColor = .label
        contentLabel?.textColor = .secondaryLabel
        valueLabel?.textColor = UIColor(named: "PrimaryBlue")
    }
}
```

## 6. 🔧 폰트 최적화 및 성능

### 6.1 폰트 로딩 최적화
```swift
// FontPreloader.swift - 앱 시작시 폰트 미리 로드
class FontPreloader {
    static let shared = FontPreloader()
    
    private let fontNames = [
        "ChosunCentennial-Light",
        "ChosunCentennial-Regular",
        "ChosunCentennial-Medium",
        "ChosunCentennial-Bold",
        "ChosunCentennial-ExtraBold"
    ]
    
    func preloadFonts() {
        for fontName in fontNames {
            // 각 폰트를 미리 로드하여 첫 사용시 지연을 방지
            _ = UIFont(name: fontName, size: 16)
        }
    }
    
    func validateFontsAvailability() -> [String] {
        var missingFonts: [String] = []
        
        for fontName in fontNames {
            if UIFont(name: fontName, size: 16) == nil {
                missingFonts.append(fontName)
            }
        }
        
        return missingFonts
    }
}

// AppDelegate에서 사용
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    
    // 폰트 미리 로드
    FontPreloader.shared.preloadFonts()
    
    // 폰트 가용성 확인 (디버그용)
    let missingFonts = FontPreloader.shared.validateFontsAvailability()
    if !missingFonts.isEmpty {
        print("⚠️ Missing fonts: \(missingFonts)")
    }
    
    return true
}
```

### 6.2 메모리 효율성
```swift
// FontCache.swift - 폰트 캐싱 시스템
class FontCache {
    static let shared = FontCache()
    private var cache: [String: UIFont] = [:]
    
    func font(name: String, size: CGFloat) -> UIFont? {
        let key = "\(name)-\(size)"
        
        if let cachedFont = cache[key] {
            return cachedFont
        }
        
        if let font = UIFont(name: name, size: size) {
            cache[key] = font
            return font
        }
        
        return nil
    }
    
    func clearCache() {
        cache.removeAll()
    }
}

// ChosunFont 확장에서 캐시 사용
extension ChosunFont {
    var cachedFont: UIFont {
        let fontName: String
        let size: CGFloat
        
        switch self {
        case .light(let s):
            fontName = "ChosunCentennial-Light"
            size = s
        case .regular(let s):
            fontName = "ChosunCentennial-Regular"
            size = s
        case .medium(let s):
            fontName = "ChosunCentennial-Medium"
            size = s
        case .bold(let s):
            fontName = "ChosunCentennial-Bold"
            size = s
        case .extraBold(let s):
            fontName = "ChosunCentennial-ExtraBold"
            size = s
        }
        
        return FontCache.shared.font(name: fontName, size: size) 
            ?? UIFont.systemFont(ofSize: size, weight: systemWeight)
    }
}
```

## 7. 🧪 테스트 및 검증

### 7.1 폰트 적용 테스트
```swift
// FontTests.swift - 폰트 적용 단위 테스트
import XCTest
@testable import Way3

class FontTests: XCTestCase {
    
    func testChosunFontAvailability() {
        let fontNames = [
            "ChosunCentennial-Light",
            "ChosunCentennial-Regular", 
            "ChosunCentennial-Medium",
            "ChosunCentennial-Bold",
            "ChosunCentennial-ExtraBold"
        ]
        
        for fontName in fontNames {
            let font = UIFont(name: fontName, size: 16)
            XCTAssertNotNil(font, "Font \(fontName) should be available")
        }
    }
    
    func testFontSizeConsistency() {
        let titleFont = UIFont.chosunTitle()
        let headlineFont = UIFont.chosunHeadline()
        let bodyFont = UIFont.chosunBody()
        
        XCTAssertGreaterThan(titleFont.pointSize, headlineFont.pointSize)
        XCTAssertGreaterThan(headlineFont.pointSize, bodyFont.pointSize)
    }
    
    func testDynamicFontScaling() {
        // 접근성 설정 변경에 따른 폰트 크기 변화 테스트
        let manager = DynamicFontManager.shared
        
        let normalSize = manager.font(for: "body", weight: .regular(16))
        let largeSize = manager.font(for: "body", weight: .regular(16))
        
        // 실제 접근성 설정에 따라 다른 크기를 반환하는지 확인
        XCTAssertNotEqual(normalSize.pointSize, largeSize.pointSize)
    }
}
```

이제 Way3 앱의 완전한 ChosunCentennial 폰트 통합 시스템이 완성되었습니다. 접근성과 성능을 고려한 체계적인 폰트 관리 시스템으로, Pokemon GO 스타일의 위치기반 무역 게임에 한국적 정체성을 부여합니다.
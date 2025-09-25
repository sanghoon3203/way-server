# Way3 Mobile App - 기술적 구현 명세서

## 1. 🎯 상인 발견 및 상호작용 시스템

### 1.1 근접 감지 (Proximity Detection)
```swift
// CoreLocation을 사용한 상인 근접 감지
class MerchantProximityManager: NSObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    private var merchants: [Merchant] = []
    private let proximityThreshold: CLLocationDistance = 50.0 // 50m
    
    func startMonitoring() {
        locationManager.delegate = self
        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
        locationManager.distanceFilter = 10.0 // 10m마다 업데이트
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let currentLocation = locations.last else { return }
        checkNearbyMerchants(at: currentLocation)
    }
    
    private func checkNearbyMerchants(at location: CLLocation) {
        let nearbyMerchants = merchants.filter { merchant in
            let merchantLocation = CLLocation(latitude: merchant.latitude, longitude: merchant.longitude)
            return location.distance(from: merchantLocation) <= proximityThreshold
        }
        
        // 새로운 상인 발견시 알림
        for merchant in nearbyMerchants {
            if !merchant.isDiscovered {
                triggerMerchantDiscovery(merchant: merchant)
            }
        }
    }
    
    private func triggerMerchantDiscovery(merchant: Merchant) {
        // 진동 알림
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        
        // 푸시 알림
        let notification = UNMutableNotificationContent()
        notification.title = "새로운 상인 발견!"
        notification.body = "\(merchant.name)이(가) 근처에 있습니다."
        notification.sound = .default
        
        // 시각적 효과
        showMerchantDiscoveryAnimation(merchant: merchant)
    }
}
```

### 1.2 상인 정보 팝업 시스템
```swift
// 상인 상세정보 모달
class MerchantDetailViewController: UIViewController {
    @IBOutlet weak var merchantImageView: UIImageView!
    @IBOutlet weak var merchantNameLabel: UILabel!
    @IBOutlet weak var merchantDescriptionLabel: UILabel!
    @IBOutlet weak var distanceLabel: UILabel!
    @IBOutlet weak var ratingView: UIStackView!
    @IBOutlet weak var inventoryCollectionView: UICollectionView!
    
    var merchant: Merchant!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadMerchantData()
    }
    
    private func setupUI() {
        // ChosunCentennial 폰트 적용
        merchantNameLabel.font = UIFont(name: "ChosunCentennial", size: 24)
        merchantDescriptionLabel.font = UIFont(name: "ChosunCentennial", size: 16)
        distanceLabel.font = UIFont(name: "ChosunCentennial", size: 14)
        
        // 카드 스타일 적용
        view.layer.cornerRadius = 16
        view.layer.shadowOpacity = 0.2
        view.layer.shadowOffset = CGSize(width: 0, height: 4)
        view.layer.shadowRadius = 8
    }
    
    private func loadMerchantData() {
        merchantNameLabel.text = merchant.name
        merchantDescriptionLabel.text = merchant.description
        distanceLabel.text = "\(Int(merchant.distance))m 거리"
        setupRatingView()
        setupInventoryPreview()
    }
    
    private func setupInventoryPreview() {
        // 주요 아이템 3-4개 미리보기 표시
        let previewItems = Array(merchant.inventory.prefix(4))
        // CollectionView 설정
    }
    
    @IBAction func startTradeButtonTapped(_ sender: UIButton) {
        let storyboard = UIStoryboard(name: "Trade", bundle: nil)
        let tradeVC = storyboard.instantiateViewController(withIdentifier: "TradeViewController") as! TradeViewController
        tradeVC.merchant = merchant
        present(tradeVC, animated: true)
    }
}
```

## 2. 💱 거래 인터페이스 상세 설계

### 2.1 카드 기반 거래 UI
```swift
// 거래 아이템 카드 뷰
class TradeItemCardView: UIView {
    @IBOutlet weak var itemImageView: UIImageView!
    @IBOutlet weak var itemNameLabel: UILabel!
    @IBOutlet weak var priceLabel: UILabel!
    @IBOutlet weak var quantityLabel: UILabel!
    @IBOutlet weak var quantitySlider: UISlider!
    @IBOutlet weak var addToCartButton: UIButton!
    
    var item: TradeItem! {
        didSet {
            updateUI()
        }
    }
    
    private func updateUI() {
        itemNameLabel.text = item.name
        priceLabel.text = "\(item.price)원"
        quantityLabel.text = "재고: \(item.quantity)"
        
        // 가격에 따른 색상 변경
        let priceColor = item.isProfitable ? UIColor.systemGreen : UIColor.systemRed
        priceLabel.textColor = priceColor
        
        // 애니메이션 효과
        layer.cornerRadius = 12
        layer.shadowOpacity = 0.1
        layer.shadowOffset = CGSize(width: 0, height: 2)
        layer.shadowRadius = 4
    }
    
    @IBAction func quantitySliderChanged(_ sender: UISlider) {
        let quantity = Int(sender.value)
        quantityLabel.text = "수량: \(quantity)"
        
        let totalPrice = item.price * quantity
        priceLabel.text = "\(totalPrice)원"
        
        // 실시간 수익 계산
        calculateProfitPreview(quantity: quantity)
    }
    
    private func calculateProfitPreview(quantity: Int) {
        let profit = (item.sellingPrice - item.price) * quantity
        let profitLabel = viewWithTag(1001) as? UILabel
        profitLabel?.text = "예상 수익: \(profit > 0 ? "+" : "")\(profit)원"
        profitLabel?.textColor = profit > 0 ? .systemGreen : .systemRed
    }
}
```

### 2.2 거래 처리 로직
```swift
// 거래 매니저
class TradeManager {
    static let shared = TradeManager()
    private let apiClient = APIClient.shared
    
    func executeTrade(with merchant: Merchant, items: [TradeItem]) async throws -> TradeResult {
        // 1. 서버에 거래 요청
        let tradeRequest = TradeRequest(
            merchantId: merchant.id,
            items: items.map { TradeItemRequest(itemId: $0.id, quantity: $0.quantity, action: $0.action) }
        )
        
        // 2. API 호출
        let result = try await apiClient.executeTrade(request: tradeRequest)
        
        // 3. 로컬 인벤토리 업데이트
        await updateLocalInventory(with: result)
        
        // 4. 경험치 및 퀘스트 진행 처리
        await processTradeRewards(result: result)
        
        // 5. WebSocket으로 실시간 업데이트
        SocketManager.shared.emit("trade:complete", data: result.toJSON())
        
        return result
    }
    
    private func updateLocalInventory(with result: TradeResult) async {
        let context = CoreDataManager.shared.context
        
        for item in result.purchasedItems {
            // 구매한 아이템 인벤토리에 추가
            let inventoryItem = PlayerInventory(context: context)
            inventoryItem.itemId = item.id
            inventoryItem.quantity = Int32(item.quantity)
            inventoryItem.purchasePrice = item.price
            inventoryItem.purchaseDate = Date()
        }
        
        for item in result.soldItems {
            // 판매한 아이템 인벤토리에서 제거
            // Core Data에서 해당 아이템 수량 차감
        }
        
        try? context.save()
    }
    
    private func processTradeRewards(result: TradeResult) async {
        // 경험치 계산 및 적용
        let expGained = calculateExperienceGain(from: result)
        PlayerManager.shared.addExperience(expGained)
        
        // 퀘스트 진행상황 업데이트
        QuestManager.shared.updateQuestProgress(for: .trade, data: result)
        
        // 업적 체크
        AchievementManager.shared.checkTradeAchievements(result: result)
    }
}
```

## 3. 👤 플레이어 프로필 및 인벤토리 관리

### 3.1 플레이어 프로필 화면
```swift
// 플레이어 프로필 뷰 컨트롤러
class PlayerProfileViewController: UIViewController {
    @IBOutlet weak var profileImageView: UIImageView!
    @IBOutlet weak var nicknameLabel: UILabel!
    @IBOutlet weak var levelLabel: UILabel!
    @IBOutlet weak var experienceProgressView: UIProgressView!
    @IBOutlet weak var moneyLabel: UILabel!
    @IBOutlet weak var energyLabel: UILabel!
    @IBOutlet weak var totalTradesLabel: UILabel!
    @IBOutlet weak var totalProfitLabel: UILabel!
    @IBOutlet weak var rankingLabel: UILabel!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadPlayerData()
    }
    
    private func setupUI() {
        // ChosunCentennial 폰트 적용
        nicknameLabel.font = UIFont(name: "ChosunCentennial-Bold", size: 28)
        levelLabel.font = UIFont(name: "ChosunCentennial", size: 20)
        moneyLabel.font = UIFont(name: "ChosunCentennial", size: 18)
        
        // 프로필 이미지 원형 처리
        profileImageView.layer.cornerRadius = profileImageView.frame.width / 2
        profileImageView.layer.borderWidth = 3
        profileImageView.layer.borderColor = UIColor.systemBlue.cgColor
        
        // 경험치 바 스타일링
        experienceProgressView.layer.cornerRadius = 8
        experienceProgressView.progressTintColor = UIColor.systemGreen
    }
    
    private func loadPlayerData() {
        Task {
            do {
                let playerData = try await APIClient.shared.getPlayerProfile()
                updateUI(with: playerData)
            } catch {
                showError(error)
            }
        }
    }
    
    private func updateUI(with player: Player) {
        nicknameLabel.text = player.nickname
        levelLabel.text = "Lv. \(player.level)"
        moneyLabel.text = "💰 \(player.money.formatted())원"
        energyLabel.text = "⚡ \(player.energy)/100"
        totalTradesLabel.text = "총 거래: \(player.totalTrades)회"
        totalProfitLabel.text = "총 수익: \(player.totalProfit.formatted())원"
        
        // 경험치 진행바
        let progress = Float(player.currentExp) / Float(player.expToNextLevel)
        experienceProgressView.setProgress(progress, animated: true)
        
        // 랭킹 정보
        if let ranking = player.ranking {
            rankingLabel.text = "전국 \(ranking)위"
            rankingLabel.textColor = getRankingColor(ranking: ranking)
        }
    }
    
    private func getRankingColor(ranking: Int) -> UIColor {
        switch ranking {
        case 1: return UIColor.systemYellow // 금색
        case 2: return UIColor.systemGray // 은색
        case 3: return UIColor.systemOrange // 동색
        default: return UIColor.label
        }
    }
}
```

### 3.2 인벤토리 관리 시스템
```swift
// 인벤토리 뷰 컨트롤러
class InventoryViewController: UIViewController {
    @IBOutlet weak var searchBar: UISearchBar!
    @IBOutlet weak var filterSegmentedControl: UISegmentedControl!
    @IBOutlet weak var sortButton: UIButton!
    @IBOutlet weak var inventoryCollectionView: UICollectionView!
    
    private var inventoryItems: [InventoryItem] = []
    private var filteredItems: [InventoryItem] = []
    
    enum SortOption: String, CaseIterable {
        case name = "이름순"
        case price = "가격순"
        case quantity = "수량순"
        case recent = "최근순"
    }
    
    enum FilterOption: String, CaseIterable {
        case all = "전체"
        case food = "식료품"
        case craft = "공예품"
        case luxury = "명품"
        case rare = "희귀템"
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupCollectionView()
        setupSearchAndFilter()
        loadInventoryData()
    }
    
    private func setupCollectionView() {
        let layout = UICollectionViewFlowLayout()
        layout.itemSize = CGSize(width: (view.frame.width - 30) / 2, height: 200)
        layout.minimumInteritemSpacing = 10
        layout.minimumLineSpacing = 15
        layout.sectionInset = UIEdgeInsets(top: 15, left: 10, bottom: 15, right: 10)
        
        inventoryCollectionView.collectionViewLayout = layout
        inventoryCollectionView.delegate = self
        inventoryCollectionView.dataSource = self
    }
    
    private func loadInventoryData() {
        Task {
            do {
                inventoryItems = try await APIClient.shared.getPlayerInventory()
                filteredItems = inventoryItems
                await MainActor.run {
                    inventoryCollectionView.reloadData()
                }
            } catch {
                showError(error)
            }
        }
    }
    
    @IBAction func sortButtonTapped(_ sender: UIButton) {
        let alert = UIAlertController(title: "정렬 방식", message: nil, preferredStyle: .actionSheet)
        
        for option in SortOption.allCases {
            alert.addAction(UIAlertAction(title: option.rawValue, style: .default) { _ in
                self.sortItems(by: option)
            })
        }
        
        alert.addAction(UIAlertAction(title: "취소", style: .cancel))
        present(alert, animated: true)
    }
    
    private func sortItems(by option: SortOption) {
        switch option {
        case .name:
            filteredItems.sort { $0.name < $1.name }
        case .price:
            filteredItems.sort { $0.currentMarketPrice > $1.currentMarketPrice }
        case .quantity:
            filteredItems.sort { $0.quantity > $1.quantity }
        case .recent:
            filteredItems.sort { $0.acquiredDate > $1.acquiredDate }
        }
        
        inventoryCollectionView.reloadData()
    }
    
    @IBAction func filterChanged(_ sender: UISegmentedControl) {
        let selectedFilter = FilterOption.allCases[sender.selectedSegmentIndex]
        applyFilter(selectedFilter)
    }
    
    private func applyFilter(_ filter: FilterOption) {
        if filter == .all {
            filteredItems = inventoryItems
        } else {
            filteredItems = inventoryItems.filter { $0.category == filter.rawValue }
        }
        
        inventoryCollectionView.reloadData()
    }
}

// 인벤토리 아이템 셀
class InventoryItemCell: UICollectionViewCell {
    @IBOutlet weak var itemImageView: UIImageView!
    @IBOutlet weak var itemNameLabel: UILabel!
    @IBOutlet weak var quantityLabel: UILabel!
    @IBOutlet weak var purchasePriceLabel: UILabel!
    @IBOutlet weak var currentPriceLabel: UILabel!
    @IBOutlet weak var profitLabel: UILabel!
    
    var item: InventoryItem! {
        didSet {
            updateUI()
        }
    }
    
    private func updateUI() {
        itemNameLabel.text = item.name
        quantityLabel.text = "보유: \(item.quantity)개"
        purchasePriceLabel.text = "구매가: \(item.purchasePrice)원"
        currentPriceLabel.text = "현재가: \(item.currentMarketPrice)원"
        
        // 수익/손실 계산 및 표시
        let profit = (item.currentMarketPrice - item.purchasePrice) * item.quantity
        profitLabel.text = "\(profit > 0 ? "+" : "")\(profit)원"
        profitLabel.textColor = profit > 0 ? .systemGreen : .systemRed
        
        // 카드 스타일
        layer.cornerRadius = 12
        layer.shadowOpacity = 0.1
        layer.shadowOffset = CGSize(width: 0, height: 2)
        layer.shadowRadius = 4
        backgroundColor = UIColor.systemBackground
        
        // 희귀도에 따른 테두리 색상
        switch item.rarity {
        case .common:
            layer.borderColor = UIColor.systemGray.cgColor
        case .rare:
            layer.borderColor = UIColor.systemBlue.cgColor
        case .epic:
            layer.borderColor = UIColor.systemPurple.cgColor
        case .legendary:
            layer.borderColor = UIColor.systemOrange.cgColor
        }
        layer.borderWidth = 2
    }
}
```

## 4. 🔄 실시간 기능 통합

### 4.1 WebSocket 매니저
```swift
// 실시간 통신 매니저
class SocketManager: NSObject {
    static let shared = SocketManager()
    private var socket: SocketIOClient!
    private let manager: SocketManager!
    
    override init() {
        manager = SocketManager(socketURL: URL(string: "http://localhost:3000")!, config: [.log(true), .compress])
        socket = manager.defaultSocket
        super.init()
        setupSocketEvents()
    }
    
    func connect() {
        socket.connect()
    }
    
    func disconnect() {
        socket.disconnect()
    }
    
    private func setupSocketEvents() {
        // 위치 업데이트
        socket.on("location:update") { [weak self] data, ack in
            if let locationData = data[0] as? [String: Any] {
                self?.handleLocationUpdate(locationData)
            }
        }
        
        // 가격 변동 알림
        socket.on("market:price:update") { [weak self] data, ack in
            if let priceData = data[0] as? [String: Any] {
                self?.handlePriceUpdate(priceData)
            }
        }
        
        // 새로운 상인 발견
        socket.on("merchant:discovered") { [weak self] data, ack in
            if let merchantData = data[0] as? [String: Any] {
                self?.handleMerchantDiscovered(merchantData)
            }
        }
        
        // 퀘스트 완료 알림
        socket.on("quest:completed") { [weak self] data, ack in
            if let questData = data[0] as? [String: Any] {
                self?.handleQuestCompleted(questData)
            }
        }
    }
    
    // 플레이어 위치 전송
    func sendLocationUpdate(latitude: Double, longitude: Double) {
        let locationData: [String: Any] = [
            "latitude": latitude,
            "longitude": longitude,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        socket.emit("player:location:update", locationData)
    }
    
    private func handlePriceUpdate(_ data: [String: Any]) {
        // 가격 변동 알림 표시
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: .marketPriceUpdated, object: data)
        }
    }
    
    private func handleMerchantDiscovered(_ data: [String: Any]) {
        // 새로운 상인 발견 알림
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: .merchantDiscovered, object: data)
        }
    }
}

// 알림 이름 확장
extension Notification.Name {
    static let marketPriceUpdated = Notification.Name("marketPriceUpdated")
    static let merchantDiscovered = Notification.Name("merchantDiscovered")
    static let questCompleted = Notification.Name("questCompleted")
}
```

### 4.2 실시간 가격 업데이트 처리
```swift
// 가격 모니터링 서비스
class PriceMonitoringService {
    static let shared = PriceMonitoringService()
    private var trackedItems: Set<String> = []
    
    init() {
        setupNotificationObservers()
    }
    
    private func setupNotificationObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handlePriceUpdate),
            name: .marketPriceUpdated,
            object: nil
        )
    }
    
    @objc private func handlePriceUpdate(_ notification: Notification) {
        guard let priceData = notification.object as? [String: Any],
              let itemId = priceData["itemId"] as? String,
              let newPrice = priceData["price"] as? Double,
              let oldPrice = priceData["oldPrice"] as? Double else { return }
        
        // 가격 변동률 계산
        let changePercent = ((newPrice - oldPrice) / oldPrice) * 100
        
        // 사용자 보유 아이템인지 확인
        if PlayerInventory.shared.hasItem(itemId: itemId) {
            showPriceChangeNotification(
                itemId: itemId,
                newPrice: newPrice,
                changePercent: changePercent
            )
        }
        
        // 관심 아이템 가격 알림
        if trackedItems.contains(itemId) && abs(changePercent) > 5.0 {
            showSignificantPriceChangeAlert(
                itemId: itemId,
                changePercent: changePercent
            )
        }
    }
    
    private func showPriceChangeNotification(itemId: String, newPrice: Double, changePercent: Double) {
        let content = UNMutableNotificationContent()
        content.title = "가격 변동 알림"
        content.body = "보유하신 아이템의 가격이 \(String(format: "%.1f", changePercent))% 변동되었습니다."
        content.sound = .default
        
        let request = UNNotificationRequest(
            identifier: "price_change_\(itemId)",
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request)
    }
    
    func addItemToTracking(itemId: String) {
        trackedItems.insert(itemId)
    }
    
    func removeItemFromTracking(itemId: String) {
        trackedItems.remove(itemId)
    }
}
```

이제 완전한 Pokemon GO 스타일의 위치기반 무역 게임 앱의 상세 구현 명세가 완성되었습니다. ChosunCentennial 폰트를 기본으로 사용하며, 실시간 상인 발견, 직관적인 거래 인터페이스, 포괄적인 인벤토리 관리 시스템까지 모든 핵심 기능이 포함되어 있습니다.